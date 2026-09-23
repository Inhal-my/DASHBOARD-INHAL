# Tab Berita Acara Menjadi Tabel (new-code1-cf) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah tab "Berita Acara" di `new-code1-cf/public/dashboard.html` dari daftar kartu menjadi kartu statistik + tabel data dengan pencarian, sortir, dan baris expand peserta.

**Architecture:** Semua perubahan ada di satu file statis `public/dashboard.html` (Vue 3 options API + Tailwind yang sudah di-precompile inline). Tidak ada perubahan backend/API. Pencarian, sortir, dan agregat kartu dihitung di sisi klien lewat computed Vue; filter Blok/Bagian tetap memakai `applyBaFilter()`.

**Tech Stack:** Vue 3 (global build, options API), Tailwind CSS (CSS inline tercompile), Bootstrap Icons, Cloudflare Workers static assets.

## Global Constraints

- Hanya `new-code1-cf/public/dashboard.html` yang diubah. Jangan sentuh `src/**`, `schema.sql`, atau file lain.
- Tidak ada build Tailwind. Utility class hanya yang sudah ada di blok `<style>` kedua (baris ~94). Untuk kebutuhan responsif baru, tambahkan CSS biasa di blok `<style>` pertama (baris 11-93), bukan class Tailwind baru.
- Breakpoint HP: `< 768px` (Tailwind `md`). Desktop: `>= 768px`.
- Tidak menambah komentar pada kode tanpa diminta.
- Tidak menambah dependensi baru.
- Filter yang sudah ada tetap: state `ba.fBlok`, `ba.fBagian`, method `applyBaFilter()` (`public/dashboard.html:2550`).
- `BA ID` (`r['BA ID']`) unik dan dipakai sebagai `:key`.
- JANGAN jalankan `git commit`/`git push` kecuali user memberi izin eksplisit saat eksekusi. Langkah commit di bawah bersifat pending approval.
- Verifikasi frontend bersifat manual (tidak ada test harness untuk `dashboard.html`). Setiap task diakhiri checklist verifikasi browser.
- Regresi backend dicek dengan `cd new-code1-cf && npx vitest run` (harus tetap 144 lulus).

---

## File Structure

- Modify: `new-code1-cf/public/dashboard.html`
  - `<style>` pertama (baris 11-93): tambah CSS `.ba-desktop`/`.ba-mobile` untuk perilaku responsif.
  - `data()` objek `ba` (baris 1320): tambah `q`, `sortKey`, `sortDir`.
  - computed (dekat `baBlokOptions()` baris 1392-1396): tambah `baView()` dan `baStats()`.
  - methods (dekat `applyBaFilter()`/`toggleBaExpand()` baris 2550-2560): tambah `baSort()`, `baSortIcon()`, `baSortValue()`, `baResetFilters()`.
  - section `v-if="tab==='ba'"` (baris 761-837): ganti seluruh isi section.

---

## Task 1: Fondasi JS + CSS Responsif

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (`<style>` baris 11-93; `data()` baris 1320; computed baris 1392-1396; methods baris 2550-2560)

**Interfaces:**
- Produces:
  - state: `ba.q` (string), `ba.sortKey` (string, default `'Tanggal Pelaksanaan'`), `ba.sortDir` (`'asc'|'desc'`, default `'desc'`)
  - computed: `baView` -> `Array<Row>` (hasil `ba.rows` setelah pencarian `ba.q` + sortir)
  - computed: `baStats` -> `{ total: number, peserta: number, blok: number, bagian: number }`
  - method: `baSort(key: string): void`
  - method: `baSortIcon(key: string): string` (mengembalikan kelas ikon `bi`)
  - method: `baSortValue(row, key): number|string`
  - method: `baResetFilters(): void`

- [ ] **Step 1: Tambah CSS responsif**

Di `new-code1-cf/public/dashboard.html`, tepat setelah baris 92 (`.ba-toggle.on .ba-toggle-knob { ... }`) dan sebelum `</style>` baris 93, sisipkan:

```css
        .ba-mobile { display: block; }
        .ba-desktop { display: none; }
        @media (min-width: 768px) {
            .ba-mobile { display: none; }
            .ba-desktop { display: block; }
        }
```

- [ ] **Step 2: Tambah state `ba`**

Ganti baris 1320:

Old:
```js
                    ba: { rows: [], all: [], fBlok: '', fBagian: '', modal: false, loadingOptions: false, opts: { blok: [], details: [], labs: [] }, form: { blok: '', detailKey: '', jenis: '', pilihan: '', detail: '', bagian: '', nama: '', tanggal: '', jam: '', catatan: '', file: null } },
```

New:
```js
                    ba: { rows: [], all: [], fBlok: '', fBagian: '', q: '', sortKey: 'Tanggal Pelaksanaan', sortDir: 'desc', modal: false, loadingOptions: false, opts: { blok: [], details: [], labs: [] }, form: { blok: '', detailKey: '', jenis: '', pilihan: '', detail: '', bagian: '', nama: '', tanggal: '', jam: '', catatan: '', file: null } },
```

- [ ] **Step 3: Tambah computed `baView` dan `baStats`**

Sisipkan tepat setelah blok `baBlokOptions()` (baris 1392-1396, berakhir `},`) dan sebelum `babLabOptions()`:

```js
                baView() {
                    const q = String(this.ba.q || '').trim().toLowerCase();
                    let rows = this.ba.rows || [];
                    if (q) {
                        rows = rows.filter(r => {
                            const hay = [r['Nama Kegiatan'], r.Blok, r['BA ID'], this.resolveBaBagian(r)]
                                .map(v => String(v || '').toLowerCase()).join(' ');
                            return hay.indexOf(q) !== -1;
                        });
                    }
                    const key = this.ba.sortKey;
                    const dir = this.ba.sortDir === 'asc' ? 1 : -1;
                    return rows.slice().sort((a, b) => {
                        const va = this.baSortValue(a, key);
                        const vb = this.baSortValue(b, key);
                        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
                        return String(va).localeCompare(String(vb)) * dir;
                    });
                },
                baStats() {
                    const rows = this.baView || [];
                    const blok = {};
                    const bagian = {};
                    const peserta = {};
                    let count = 0;
                    rows.forEach(r => {
                        if (r.Blok) blok[String(r.Blok).trim()] = 1;
                        const bag = this.resolveBaBagian(r);
                        if (bag) bagian[bag] = 1;
                        (r.peserta || []).forEach(p => {
                            const k = String(p.npm || p.namaLengkap || '').trim();
                            if (k && !peserta[k]) { peserta[k] = 1; count++; }
                        });
                    });
                    if (!count) count = rows.reduce((s, r) => s + (Number(r['Jumlah Peserta']) || 0), 0);
                    return { total: rows.length, peserta: count, blok: Object.keys(blok).length, bagian: Object.keys(bagian).length };
                },
```

- [ ] **Step 4: Tambah method sortir & reset**

Sisipkan tepat setelah blok `toggleBaExpand(baId)` (baris 2558-2560, berakhir `},`) dan sebelum `openBaUpload()`:

```js
                baSort(key) {
                    if (this.ba.sortKey === key) {
                        this.ba.sortDir = this.ba.sortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.ba.sortKey = key;
                        this.ba.sortDir = (key === 'Tanggal Pelaksanaan' || key === 'Timestamp' || key === 'Peserta') ? 'desc' : 'asc';
                    }
                },
                baSortIcon(key) {
                    if (this.ba.sortKey !== key) return 'bi bi-arrow-down-up ml-1 text-slate-300';
                    return this.ba.sortDir === 'asc' ? 'bi bi-arrow-up ml-1 text-brand-600' : 'bi bi-arrow-down ml-1 text-brand-600';
                },
                baSortValue(r, key) {
                    if (key === 'Tanggal Pelaksanaan') return Date.parse(r['Tanggal Pelaksanaan']) || 0;
                    if (key === 'Timestamp') return Date.parse(r.Timestamp) || 0;
                    if (key === 'Peserta') return Number(r['Jumlah Peserta'] || 0);
                    if (key === 'Blok') {
                        const s = String(r.Blok || '').trim();
                        return /^\d+$/.test(s) ? Number(s) : s.toLowerCase();
                    }
                    if (key === 'Bagian') return String(this.resolveBaBagian(r) || '').toLowerCase();
                    return String(r['Nama Kegiatan'] || '').toLowerCase();
                },
                baResetFilters() {
                    this.ba.fBlok = '';
                    this.ba.fBagian = '';
                    this.ba.q = '';
                    this.applyBaFilter();
                },
```

- [ ] **Step 5: Verifikasi tidak ada error sintaks/console**

Jalankan preview lokal (lihat cara di Task 2 Step 5) lalu buka tab Berita Acara lama (masih kartu) dan cek Console browser tidak menampilkan error. Karena computed baru belum dipakai di template, tampilan belum berubah.

Expected: halaman termuat, tab Berita Acara masih berupa daftar kartu, tidak ada error merah di Console.

- [ ] **Step 6: Commit (pending approval user)**

```bash
cd /workspace && git add new-code1-cf/public/dashboard.html && git commit -m "refactor(ba): add client-side search, sort and stats state for Berita Acara tab"
```

---

## Task 2: Ganti Template Tab Berita Acara

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (section `v-if="tab==='ba'"`, baris 761-837)

**Interfaces:**
- Consumes: `baView`, `baStats`, `baSort()`, `baSortIcon()`, `baResetFilters()`, `toggleBaExpand()`, `deleteBa()`, `openBaUpload()`, `applyBaFilter()`, `resolveBaBagian()`, `formatTanggal()`, `formatTanggalWaktu()`.
- Produces: tidak ada (task terakhir yang mengubah UI).

- [ ] **Step 1: Ganti seluruh section tab BA**

Ganti blok dari baris 761 (`<!-- ============ TAB: BERITA ACARA ============ -->`) sampai baris 837 (`</section>` penutup tab BA) dengan:

```html
                <!-- ============ TAB: BERITA ACARA ============ -->
                <section v-if="tab==='ba'">
                    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1 class="text-xl font-extrabold tracking-tight text-slate-900">Berita Acara</h1>
                            <p class="mt-0.5 text-sm text-slate-500">Dokumen berita acara kegiatan yang telah diunggah.</p>
                        </div>
                        <button class="btn-primary" @click="openBaUpload()"><i class="bi bi-upload"></i>Upload Berita Acara</button>
                    </div>

                    <div class="mb-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                        <div class="grid gap-3 md:grid-cols-12">
                            <div class="md:col-span-4">
                                <div class="master-search">
                                    <i class="bi bi-search"></i>
                                    <input v-model="ba.q" class="input" placeholder="Cari kegiatan, blok, bagian, BA ID...">
                                </div>
                            </div>
                            <div class="md:col-span-3">
                                <select v-model="ba.fBlok" class="input" @change="applyBaFilter()">
                                    <option value="">Semua Blok</option>
                                    <option v-for="b in baBlokOptions" :key="b" :value="b">{{ b }}</option>
                                </select>
                            </div>
                            <div class="md:col-span-3">
                                <select v-model="ba.fBagian" class="input" @change="applyBaFilter()">
                                    <option value="">Semua Bagian</option>
                                    <option v-for="o in bagian.options" :key="o" :value="o">{{ o }}</option>
                                </select>
                            </div>
                            <div class="md:col-span-2 flex items-center justify-between gap-2">
                                <span class="text-xs text-slate-400">{{ baView.length }} dari {{ ba.all.length }}</span>
                                <button class="btn-soft !px-3 !py-1.5 text-xs" @click="baResetFilters()"><i class="bi bi-arrow-counterclockwise"></i>Reset</button>
                            </div>
                        </div>
                    </div>

                    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                            <span class="master-stat-icon"><i class="bi bi-file-earmark-pdf"></i></span>
                            <div class="min-w-0">
                                <div class="text-2xl font-extrabold text-slate-900">{{ baStats.total }}</div>
                                <div class="text-xs text-slate-500">Total BA</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                            <span class="master-stat-icon"><i class="bi bi-people"></i></span>
                            <div class="min-w-0">
                                <div class="text-2xl font-extrabold text-slate-900">{{ baStats.peserta }}</div>
                                <div class="text-xs text-slate-500">Total Peserta</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                            <span class="master-stat-icon"><i class="bi bi-grid-3x3-gap"></i></span>
                            <div class="min-w-0">
                                <div class="text-2xl font-extrabold text-slate-900">{{ baStats.blok }}</div>
                                <div class="text-xs text-slate-500">Jumlah Blok</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                            <span class="master-stat-icon"><i class="bi bi-diagram-3"></i></span>
                            <div class="min-w-0">
                                <div class="text-2xl font-extrabold text-slate-900">{{ baStats.bagian }}</div>
                                <div class="text-xs text-slate-500">Jumlah Bagian</div>
                            </div>
                        </div>
                    </div>

                    <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div v-if="sectionLoading.ba" class="flex items-center justify-center gap-3 py-12 text-slate-400">
                            <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                            <span class="text-sm font-semibold">Memuat berita acara...</span>
                        </div>
                        <div v-else-if="!baView.length" class="px-4 py-12 text-center text-sm text-slate-400">
                            {{ ba.all.length ? 'Tidak ada berita acara yang cocok dengan filter.' : 'Belum ada data.' }}
                        </div>
                        <template v-else>
                            <div class="ba-desktop overflow-x-auto">
                                <table class="master-table w-full text-left text-sm">
                                    <thead>
                                        <tr>
                                            <th class="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold" @click="baSort('Tanggal Pelaksanaan')">Tanggal Pelaksanaan <i :class="baSortIcon('Tanggal Pelaksanaan')"></i></th>
                                            <th class="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold" @click="baSort('Blok')">Blok <i :class="baSortIcon('Blok')"></i></th>
                                            <th class="cursor-pointer px-4 py-3 font-semibold" @click="baSort('Nama Kegiatan')">Nama Kegiatan <i :class="baSortIcon('Nama Kegiatan')"></i></th>
                                            <th class="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold" @click="baSort('Bagian')">Bagian <i :class="baSortIcon('Bagian')"></i></th>
                                            <th class="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold" @click="baSort('Peserta')">Peserta <i :class="baSortIcon('Peserta')"></i></th>
                                            <th class="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold" @click="baSort('Timestamp')">Waktu Unggah <i :class="baSortIcon('Timestamp')"></i></th>
                                            <th class="px-4 py-3 font-semibold">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template v-for="r in baView" :key="r['BA ID']">
                                            <tr class="border-t border-slate-100">
                                                <td class="whitespace-nowrap px-4 py-3">{{ formatTanggalWaktu(r['Tanggal Pelaksanaan']) }}</td>
                                                <td class="px-4 py-3">{{ r.Blok }}</td>
                                                <td class="px-4 py-3">
                                                    <div class="font-semibold text-slate-900">{{ r['Nama Kegiatan'] }}</div>
                                                    <div class="font-mono text-[11px] text-slate-400">{{ r['BA ID'] }}</div>
                                                </td>
                                                <td class="whitespace-nowrap px-4 py-3"><span class="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{{ resolveBaBagian(r) }}</span></td>
                                                <td class="whitespace-nowrap px-4 py-3">
                                                    <button class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700" @click="toggleBaExpand(r['BA ID'])">
                                                        <i class="bi bi-people"></i>{{ r['Jumlah Peserta'] }}
                                                        <i :class="expandedBa[r['BA ID']] ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                                                    </button>
                                                </td>
                                                <td class="whitespace-nowrap px-4 py-3 text-slate-500">{{ formatTanggal(r.Timestamp) }}</td>
                                                <td class="px-4 py-3">
                                                    <div class="flex items-center gap-2 whitespace-nowrap">
                                                        <a v-if="r['File URL']" :href="r['File URL']" target="_blank" class="link text-xs"><i class="bi bi-eye"></i> Lihat File</a>
                                                        <button class="btn-danger-soft !px-3 !py-1.5 text-xs" @click="deleteBa(r['BA ID'])"><i class="bi bi-trash"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr v-if="expandedBa[r['BA ID']]" class="bg-slate-50">
                                                <td colspan="7" class="px-4 py-3">
                                                    <div v-if="r.peserta && r.peserta.length" class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                                        <div v-for="(p, j) in r.peserta" :key="j" class="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-slate-100">
                                                            <i class="bi bi-person text-slate-400"></i>
                                                            <span class="font-semibold">{{ p.namaLengkap }}</span>
                                                            <span class="font-mono text-[11px] text-slate-400">({{ p.npm }})</span>
                                                            <span v-if="p.blok" class="ml-auto text-[11px] text-slate-400">{{ p.blok }}</span>
                                                        </div>
                                                    </div>
                                                    <div v-else class="text-xs text-slate-400">Tidak ada data peserta.</div>
                                                </td>
                                            </tr>
                                        </template>
                                    </tbody>
                                </table>
                            </div>

                            <div class="ba-mobile divide-y divide-slate-50">
                                <div v-for="r in baView" :key="r['BA ID']" class="p-4">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                                <span class="font-mono">{{ r['BA ID'] }}</span>
                                                <span>·</span>
                                                <span>{{ formatTanggal(r.Timestamp) }}</span>
                                            </div>
                                            <div class="mt-1 text-sm font-bold text-slate-900">{{ r.Blok }} · {{ r['Nama Kegiatan'] }}</div>
                                            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                <i class="bi bi-calendar3"></i>
                                                <span>{{ formatTanggalWaktu(r['Tanggal Pelaksanaan']) }}</span>
                                            </div>
                                            <div class="mt-1.5"><span class="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{{ resolveBaBagian(r) }}</span></div>
                                        </div>
                                        <button class="btn-danger-soft shrink-0 !px-3 !py-1.5 text-xs" @click="deleteBa(r['BA ID'])"><i class="bi bi-trash"></i></button>
                                    </div>
                                    <div class="mt-3 flex flex-wrap items-center gap-3 text-xs">
                                        <button class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600" @click="toggleBaExpand(r['BA ID'])">
                                            <i class="bi bi-people"></i> {{ r['Jumlah Peserta'] }} peserta
                                            <i :class="expandedBa[r['BA ID']] ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                                        </button>
                                        <a v-if="r['File URL']" :href="r['File URL']" target="_blank" class="link"><i class="bi bi-eye"></i> Lihat File</a>
                                    </div>
                                    <div v-if="expandedBa[r['BA ID']]" class="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                        <div v-for="(p, j) in (r.peserta || [])" :key="j" class="flex items-center gap-2 text-xs text-slate-600">
                                            <i class="bi bi-person"></i>
                                            <span class="font-semibold">{{ p.namaLengkap }}</span>
                                            <span class="font-mono text-[11px] text-slate-400">({{ p.npm }})</span>
                                            <span v-if="p.blok" class="ml-auto text-[11px] text-slate-400">{{ p.blok }}</span>
                                        </div>
                                        <div v-if="!r.peserta || !r.peserta.length" class="text-xs text-slate-400">Tidak ada data peserta.</div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </section>
```

- [ ] **Step 2: Verifikasi statis (tanpa server)**

Jalankan:

```bash
cd /workspace/new-code1-cf && npx vitest run
```

Expected: `Test Files 21 passed (21)`, `Tests 144 passed (144)` (backend tidak terpengaruh).

- [ ] **Step 3: Jalankan server preview**

Gunakan skill deploy-website (atau background terminal) untuk menjalankan:

```bash
cd /workspace/new-code1-cf && npm run dev
```

Catat URL preview yang diberikan (mis. `http://localhost:8787/dashboard.html`).

- [ ] **Step 4: Verifikasi desktop (manual di browser)**

Login sebagai admin, buka tab **Berita Acara**. Cek:

1. Tampil 4 kartu statistik: Total BA, Total Peserta, Jumlah Blok, Jumlah Bagian.
2. Tabel tampil dengan 7 kolom: Tanggal Pelaksanaan, Blok, Nama Kegiatan (+ BA ID kecil), Bagian, Peserta, Waktu Unggah, Aksi.
3. Klik header **Blok** dua kali: urutan berubah asc lalu desc, ikon panah berubah.
4. Klik angka **Peserta** pada satu baris: muncul sub-baris daftar peserta (nama, NPM, blok). Klik lagi: tertutup.
5. Buka 2 baris peserta sekaligus: keduanya tetap terbuka.
6. Klik **Lihat File**: file terbuka di tab baru (jika data punya `File URL`).
7. Klik **Hapus**: muncul dialog konfirmasi "Hapus Berita Acara".
8. Isi kotak **Cari** dengan nama kegiatan: tabel & kartu statistik ikut terfilter; teks "X dari Y" berubah.
9. Ubah filter **Blok**/**Bagian**: tabel terfilter. Klik **Reset**: semua kembali.

- [ ] **Step 5: Commit (pending approval user)**

```bash
cd /workspace && git add new-code1-cf/public/dashboard.html && git commit -m "feat(ba): redesign Berita Acara tab as stat cards and data table"
```

---

## Task 3: Verifikasi Responsif & Regresi

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (hanya jika ditemukan bug saat verifikasi)

**Interfaces:**
- Consumes: seluruh hasil Task 1 & Task 2.
- Produces: tidak ada.

- [ ] **Step 1: Verifikasi tampilan HP (manual)**

Di browser, kecilkan lebar ke `< 768px` (mode device toolbar). Cek:

1. Tabel desktop tersembunyi; muncul daftar kartu ringkas per BA.
2. Kartu menampilkan BA ID + Waktu Unggah, Nama Kegiatan, Tanggal Pelaksanaan, badge Bagian, tombol jumlah peserta, dan tombol Hapus.
3. Tombol peserta membuka/menutup daftar peserta. Tombol Lihat File & Hapus berfungsi.
4. Tidak ada scroll horizontal pada halaman.
5. Kartu statistik tampil 2 kolom.

Expected: semua benar. Jika ada yang salah, perbaiki di `public/dashboard.html` lalu ulang Step 1.

- [ ] **Step 2: Verifikasi edge case data**

Cek:

1. Data kosong: ubah filter sehingga tidak ada hasil -> muncul teks "Tidak ada berita acara yang cocok dengan filter.".
2. Pencarian tanpa hasil -> pesan yang sama muncul, kartu statistik jadi 0.
3. Bila memungkinkan data hanya 1 BA -> tabel tetap tampil normal tanpa error.

- [ ] **Step 3: Regresi tab lain**

Buka tab **Telaah Pengajuan**, **Statistik**, **Laporan Bagian**, **Berita Acara Bagian**, dan **Master Data**. Pastikan tidak ada error Console dan tampilan normal (terutama karena `baView`/`baStats` tidak dipakai di sana).

- [ ] **Step 4: Regresi backend**

```bash
cd /workspace/new-code1-cf && npx vitest run
```

Expected: `Tests 144 passed (144)`.

- [ ] **Step 5: Commit perbaikan (jika ada) (pending approval user)**

```bash
cd /workspace && git add new-code1-cf/public/dashboard.html && git commit -m "fix(ba): responsive and edge-case polish for Berita Acara table"
```

---

## Catatan Coverage Spec

| Requirement spec | Task |
|---|---|
| Header + toolbar (cari, Blok, Bagian, hitungan, reset) | Task 2 Step 1 |
| Kartu statistik 4 (Total BA/Peserta/Blok/Bagian), ikut filter | Task 1 Step 3, Task 2 Step 1 |
| Tabel 7 kolom | Task 2 Step 1 |
| Sticky header, hover, zebra | Task 2 Step 1 (`.master-table`) |
| Sortir klik header + ikon, default Tanggal Pelaksanaan terbaru | Task 1 Step 3-4, Task 2 Step 1 |
| Expand peserta (bisa banyak sekaligus) | Task 2 Step 1 |
| Aksi Lihat File + Hapus (dialog) | Task 2 Step 1 |
| Loading & empty state | Task 2 Step 1 |
| Tampilan HP kartu ringkas | Task 1 Step 1, Task 2 Step 1, Task 3 Step 1 |
| Tanpa perubahan backend | Global Constraints, Task 2 Step 2 |
