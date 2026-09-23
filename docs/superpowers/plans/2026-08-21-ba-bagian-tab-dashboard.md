# Tab "Berita Acara Bagian" di Dashboard + Pemisahan Sheet BA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tab "Berita Acara Bagian" di dashboard agar admin dapat mengisi Berita Acara bagian (via sesi bagian) tanpa pindah halaman, plus memisahkan sheet fisik antara BA bagian dan BA dashboard.

**Architecture:** (1) Split sheet: `BeritaAcara`/`BeritaAcaraPeserta` khusus BA bagian; sheet baru `BeritaAcaraAdmin`/`BeritaAcaraAdminPeserta` khusus BA dashboard + migrasi data lama di `setupDatabase`. (2) Fungsi baru `adminBagianBypass` membuat sesi bagian dari token admin; semua RPC bagian yang sudah ada dipakai ulang tanpa diubah. (3) Tab baru di dashboard memakai RPC bagian tsb lewat token sesi bagian.

**Tech Stack:** Google Apps Script (`.gs`), Vue 3 (global prod CDN) di halaman HTML, Spreadsheet sebagai database.

## Global Constraints

- Semua penulisan BA bagian harus `Sumber='Bagian'` dan hanya masuk sheet `BeritaAcara`/`BeritaAcaraPeserta`.
- Semua penulisan BA dashboard harus `Sumber='Admin'` dan hanya masuk sheet `BeritaAcaraAdmin`/`BeritaAcaraAdminPeserta`.
- Jangan ubah fungsi bagian & laporan berikut: `uploadBeritaAcaraBagian`, `getBeritaAcaraList`, `getBagianBootstrap`, `_computeBaList`, `_computeBagianAggregation`, `getLaporanBootstrap`, `_computeDashboardStats`/`getDashboardStats`.
- Konvensi token: token selalu argumen terakhir. `run()` (admin) dan `runAsBab()` (sesi bagian) melampirkan token.
- Tidak menambah fungsi hapus BA bagian.
- Tidak mengubah `bagian.html` dan `detail-laporan.html`.
- Kode memakai style yang ada: JS ES5-ish di `.gs` (function + `arguments[arguments.length - 1]`); Vue Options API di halaman; tanpa komentar tambahan.
- Verifikasi sintaks: `.gs` disalin ke `.js` lalu `node --check`; JS inline halaman diekstrak lalu `node --check`.

---

### Task 1: Skema sheet baru + migrasi data di `0_code.gs`

**Files:**
- Modify: `new-code1/0_code.gs:129-150` (SCHEMAS), `new-code1/0_code.gs:368-386` (`setupDatabase`)
- Add: `migrateBeritaAcaraSheets()` di `new-code1/0_code.gs`

**Interfaces:**
- Produces: `SCHEMAS['BeritaAcaraAdmin']`, `SCHEMAS['BeritaAcaraAdminPeserta']`; `migrateBeritaAcaraSheets()` → `{ success, migrated, peserta }`; dipanggil `setupDatabase()`.
- Consumes: `getGlobalSpreadsheet`, `getHeadersFromSheet`, `rowToObject`, `objectToRow`, `_baSumber` (dari 1_business.gs), `invalidateSheetCache`.

- [ ] **Step 1: Tambah entri SCHEMAS**

Di `new-code1/0_code.gs`, setelah blok `BeritaAcaraPeserta:` (baris 142-150), tambah dua entri baru:

```js
    BeritaAcaraAdmin: [
        'Timestamp',
        'BA ID',
        'Bagian',
        'Blok',
        'Nama Kegiatan',
        'Tanggal Pelaksanaan',
        'Jumlah Peserta',
        'File Name',
        'File URL',
        'Catatan',
        'Sumber'
    ],
    BeritaAcaraAdminPeserta: [
        'Timestamp',
        'BA ID',
        'NPM',
        'Nama Lengkap',
        'Blok',
        'Bagian',
        'Status Pengajuan'
    ],
```

- [ ] **Step 2: Tambah fungsi `migrateBeritaAcaraSheets`**

Tambah di akhir `new-code1/0_code.gs` (sebelum `deleteRowByKey` atau setelahnya, aman di mana pun):

```js
function migrateBeritaAcaraSheets() {
    const ss = getGlobalSpreadsheet();
    const baSheet = ss.getSheetByName('BeritaAcara');
    const pesertaSheet = ss.getSheetByName('BeritaAcaraPeserta');
    if (!baSheet || !pesertaSheet) return { success: true, migrated: 0, peserta: 0 };

    const adminSheet = ss.getSheetByName('BeritaAcaraAdmin');
    const adminPesertaSheet = ss.getSheetByName('BeritaAcaraAdminPeserta');
    if (!adminSheet || !adminPesertaSheet) {
        throw new Error('Sheet BeritaAcaraAdmin / BeritaAcaraAdminPeserta belum ada. Jalankan setupDatabase() ulang.');
    }

    const baHeaders = getHeadersFromSheet(baSheet);
    const adminHeaders = getHeadersFromSheet(adminSheet);
    const pesertaHeaders = getHeadersFromSheet(pesertaSheet);
    const adminPesertaHeaders = getHeadersFromSheet(adminPesertaSheet);

    const baLast = baSheet.getLastRow();
    const baRows = baLast > 1 ? baSheet.getRange(2, 1, baLast - 1, baSheet.getLastColumn()).getValues() : [];
    const adminBaIds = [];
    const toRemoveBa = [];
    let migrated = 0;

    baRows.forEach(function(row, i) {
        const obj = rowToObject(baHeaders, row);
        if (_baSumber(obj) !== 'Admin') return;
        const copy = {};
        adminHeaders.forEach(function(h) {
            if (obj[h] !== undefined && obj[h] !== null) copy[h] = obj[h];
        });
        adminSheet.appendRow(objectToRow(adminHeaders, copy));
        adminBaIds.push(String(obj['BA ID'] || '').trim());
        toRemoveBa.push(i + 2);
        migrated++;
    });

    const pesertaLast = pesertaSheet.getLastRow();
    const pesertaRows = pesertaLast > 1 ? pesertaSheet.getRange(2, 1, pesertaLast - 1, pesertaSheet.getLastColumn()).getValues() : [];
    const toRemovePeserta = [];
    let pesertaMigrated = 0;

    pesertaRows.forEach(function(row, i) {
        const obj = rowToObject(pesertaHeaders, row);
        if (adminBaIds.indexOf(String(obj['BA ID'] || '').trim()) === -1) return;
        const copy = {};
        adminPesertaHeaders.forEach(function(h) {
            if (obj[h] !== undefined && obj[h] !== null) copy[h] = obj[h];
        });
        adminPesertaSheet.appendRow(objectToRow(adminPesertaHeaders, copy));
        toRemovePeserta.push(i + 2);
        pesertaMigrated++;
    });

    toRemoveBa.sort(function(a, b) { return b - a; });
    toRemoveBa.forEach(function(rowIndex) { baSheet.deleteRow(rowIndex); });
    toRemovePeserta.sort(function(a, b) { return b - a; });
    toRemovePeserta.forEach(function(rowIndex) { pesertaSheet.deleteRow(rowIndex); });

    if (migrated > 0) {
        invalidateSheetCache('BeritaAcara');
        invalidateSheetCache('BeritaAcaraPeserta');
        invalidateSheetCache('BeritaAcaraAdmin');
        invalidateSheetCache('BeritaAcaraAdminPeserta');
    }

    return { success: true, migrated: migrated, peserta: pesertaMigrated };
}
```

- [ ] **Step 3: Panggil migrasi di `setupDatabase`**

Di `new-code1/0_code.gs`, dalam `setupDatabase()` (baris 368), setelah `applyDataValidation(ss);` tambahkan:

```js
    const migration = migrateBeritaAcaraSheets();
    console.log('migrateBeritaAcaraSheets:', JSON.stringify(migration));
```

- [ ] **Step 4: Verifikasi sintaks**

```bash
mkdir -p /tmp/opencode/check
cp new-code1/0_code.gs /tmp/opencode/check/0_code.js
node --check /tmp/opencode/check/0_code.js
```
Expected: tidak ada output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add new-code1/0_code.gs
git commit -m "feat(schema): separate admin BA sheets + migration"
```

---

### Task 2: Arahkan fungsi BA admin ke sheet baru di `1_business.gs`

**Files:**
- Modify: `new-code1/1_business.gs` — `_getBaPesertaMap` (baris 1245), `getBeritaAcaraAdminList` (baris 1690), `deleteBeritaAcaraAdmin` (baris 1706), `getDashboardBootstrap` (baris 1430), `uploadBeritaAcaraAdmin` (baris 2466)

**Interfaces:**
- Consumes: `getAllRows`, `getRowByKey`, `deleteRowByKey`, `_clientRow`, `generateBaId`, `_saveFileToDrive`, `appendRowSafe`, `_resolveBaPesertaFromDetail`, `normalizeBaPeserta`, `requireAuthorized`.
- Produces: `_getBaPesertaMapAdmin()` → `{ [baId]: [{ npm, namaLengkap, blok }] }`.

- [ ] **Step 1: Tambah `_getBaPesertaMapAdmin`**

Setelah `_getBaPesertaMap` (berakhir baris 1258), tambahkan:

```js
function _getBaPesertaMapAdmin() {
    const map = {};
    getAllRows('BeritaAcaraAdminPeserta').forEach(function(r) {
        const id = String(r['BA ID'] || '').trim();
        if (!id) return;
        if (!map[id]) map[id] = [];
        map[id].push({
            npm: String(r.NPM || '').trim(),
            namaLengkap: String(r['Nama Lengkap'] || '').trim(),
            blok: String(r.Blok || '').trim()
        });
    });
    return map;
}
```

- [ ] **Step 2: Ubah `getBeritaAcaraAdminList`**

Ganti isi fungsi (baris 1690-1704) menjadi:

```js
function getBeritaAcaraAdminList() {
    requireAuthorized(arguments[arguments.length - 1]);
    const rows = getAllRows('BeritaAcaraAdmin');
    rows.sort(function(a, b) {
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
    const pesertaMap = _getBaPesertaMapAdmin();
    return rows.map(function(r) {
        const c = _clientRow(r);
        c.peserta = pesertaMap[String(r['BA ID'] || '').trim()] || [];
        return c;
    });
}
```

- [ ] **Step 3: Ubah `deleteBeritaAcaraAdmin`**

Ganti referensi sheet (baris 1706-1732): `'BeritaAcara'` → `'BeritaAcaraAdmin'` dan `'BeritaAcaraPeserta'` → `'BeritaAcaraAdminPeserta'`. Hasil akhir fungsi:

```js
function deleteBeritaAcaraAdmin(baId) {
    requireAuthorized(arguments[arguments.length - 1]);
    const baIdVal = String(baId || '').trim();
    if (!baIdVal) return { success: false, message: 'BA ID wajib diisi.' };

    const existing = getRowByKey('BeritaAcaraAdmin', 'BA ID', baIdVal);
    if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

    deleteRowByKey('BeritaAcaraAdmin', 'BA ID', baIdVal, 'Dihapus dari Panel Admin', getActorName());

    const pesertaRows = getAllRows('BeritaAcaraAdminPeserta').filter(function(r) {
        return String(r['BA ID'] || '').trim() === baIdVal;
    });
    pesertaRows.forEach(function(r) {
        deleteRowByKey('BeritaAcaraAdminPeserta', 'BA ID', baIdVal, 'Hapus peserta menyertai BA', getActorName());
    });

    const fileUrl = String(existing['File URL'] || '');
    const idMatch = fileUrl.match(/[=\/]([\w\-]{20,})/);
    if (idMatch) {
        try {
            DriveApp.getFileById(idMatch[1]).setTrashed(true);
        } catch (e) { }
    }

    return { success: true, message: 'Berita acara berhasil dihapus.' };
}
```

- [ ] **Step 4: Ubah `getDashboardBootstrap`**

Di `getDashboardBootstrap` (baris 1430-1466):
- Ganti `const baPesertaMap = _getBaPesertaMap();` menjadi `const adminBaPesertaMap = _getBaPesertaMapAdmin();`
- Hapus `const sortedBa = ba.slice().sort(...)` (dua baris, baris 1441-1443).
- Tambahkan `const adminBa = getAllRows('BeritaAcaraAdmin').slice().sort(function(a, b) { return String(b.Timestamp || '').localeCompare(String(a.Timestamp || '')); });`
- Ganti field `beritaAcara` menjadi:

```js
        beritaAcara: adminBa.map(function(r) {
            const c = _clientRow(r);
            c.peserta = adminBaPesertaMap[String(r['BA ID'] || '').trim()] || [];
            return c;
        })
```

Catatan: `ba` (dari `BeritaAcara`) tetap dipakai untuk `stats` dan `bagian` — jangan diubah.

- [ ] **Step 5: Ubah `uploadBeritaAcaraAdmin`**

Di `uploadBeritaAcaraAdmin` (baris 2466-2518):
- Ganti `const baSheet = ss.getSheetByName('BeritaAcara');` menjadi `const baSheet = ss.getSheetByName('BeritaAcaraAdmin');`
- Ganti pesan error `'Sheet BeritaAcara tidak ditemukan...'` menjadi `'Sheet BeritaAcaraAdmin tidak ditemukan. Jalankan setupDatabase() dahulu.'`
- Ganti `appendRowSafe('BeritaAcara', {` menjadi `appendRowSafe('BeritaAcaraAdmin', {`
- Ganti `appendRowSafe('BeritaAcaraPeserta', {` menjadi `appendRowSafe('BeritaAcaraAdminPeserta', {`

- [ ] **Step 6: Verifikasi sintaks**

```bash
cp new-code1/1_business.gs /tmp/opencode/check/1_business.js
node --check /tmp/opencode/check/1_business.js
```
Expected: tidak ada output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(ba): route admin BA to separate sheets"
```

---

### Task 3: Fungsi `adminBagianBypass` di `1_business.gs`

**Files:**
- Modify: `new-code1/1_business.gs` — setelah `logoutSession` (baris 53)

**Interfaces:**
- Consumes: `requireAuthorized`, `createSession`.
- Produces: `adminBagianBypass(kategori, subBagian)` → `{ ok, token?, nama?, kategori?, subBagian?, message? }`. Token valid untuk RPC bagian (role `'bagian'`).

- [ ] **Step 1: Tambah fungsi**

Setelah fungsi `logoutSession` (berakhir baris 53), tambahkan:

```js
function adminBagianBypass(kategori, subBagian) {
    const admin = requireAuthorized(arguments[arguments.length - 1]);
    const kat = String(kategori || '').trim();
    const allowedCats = ['SGD', 'KKD', 'Ujian', 'Praktikum'];
    if (allowedCats.indexOf(kat) === -1) {
        return { ok: false, message: 'Pilih kategori kegiatan terlebih dahulu.' };
    }
    const sub = String(subBagian || '').trim();
    if (kat === 'Praktikum' && !sub) {
        return { ok: false, message: 'Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.' };
    }
    const token = createSession({ role: 'bagian', nama: admin.nama || 'Admin', kategori: kat, subBagian: sub, kategoris: [kat] });
    return { ok: true, token: token, nama: admin.nama || 'Admin', kategori: kat, subBagian: sub };
}
```

- [ ] **Step 2: Verifikasi sintaks**

```bash
cp new-code1/1_business.gs /tmp/opencode/check/1_business.js
node --check /tmp/opencode/check/1_business.js
```
Expected: tidak ada output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(ba): add adminBagianBypass to create bagian session from admin token"
```

---

### Task 4: Dashboard — nav, data, sesi bagian, dan section tahap 1

**Files:**
- Modify: `new-code1/pages/dashboard.html` — navItems (baris 953-961), pageTitle (baris 950-952), data (baris 898-944), `run` (baris 1047-1062), `logout` (baris 1084-1093), `switchTab` (baris 1159-1167), section baru setelah baris 429.

**Interfaces:**
- Consumes: `adminBagianBypass`, `getBagianBootstrap`, `getBeritaAcaraList`, `getBagianBaSettings`, `uploadBeritaAcaraBagian`, `logoutSession` (via `google.script.run`).
- Produces: `runAsBab(fn, ...args)`; state `this.bab`; `babStart()`, `babEnd()`, `babLoad()`, `babLoadBaList()`, `dateOnly(v)`; computed `babLabOptions`.

- [ ] **Step 1: Tambah item nav & pageTitle**

Di `pageTitle` (baris 951), ganti:

```js
                    return { pengajuan: 'Telaah Pengajuan', stats: 'Statistik', bagian: 'Laporan Bagian', ba: 'Berita Acara', master: 'Master Data' }[this.tab] || 'Dashboard';
```

menjadi:

```js
                    return { pengajuan: 'Telaah Pengajuan', stats: 'Statistik', bagian: 'Laporan Bagian', baBagian: 'Berita Acara Bagian', ba: 'Berita Acara', master: 'Master Data' }[this.tab] || 'Dashboard';
```

Di `navItems` (baris 954-960), ganti:

```js
                        { key: 'bagian', icon: 'bi-diagram-3', label: 'Laporan Bagian' },
                        { key: 'ba', icon: 'bi-file-earmark-pdf', label: 'Berita Acara' },
```

menjadi:

```js
                        { key: 'bagian', icon: 'bi-diagram-3', label: 'Laporan Bagian' },
                        { key: 'baBagian', icon: 'bi-journal-check', label: 'Berita Acara Bagian' },
                        { key: 'ba', icon: 'bi-file-earmark-pdf', label: 'Berita Acara' },
```

- [ ] **Step 2: Tambah state `bab` di data()**

Setelah `expandedBa: {},` (baris 921), tambahkan:

```js
                    bab: {
                        kategori: '',
                        subBagian: '',
                        token: null,
                        nama: '',
                        active: false,
                        loading: false,
                        rows: [],
                        baList: [],
                        fBlok: '',
                        baSettings: { statuses: ['Diterima', 'ACC'], finalOnly: true },
                        ba: { open: false, kegiatanKey: null, tanggal: '', catatan: '', file: null, fileName: '', selected: {}, confirm: false }
                    },
```

- [ ] **Step 3: Tambah method `runAsBab`, `dateOnly`, `babStart`, `babEnd`, `babLoad`, `babLoadBaList`**

Setelah method `run` (berakhir baris 1062), tambahkan:

```js
                runAsBab(fn, ...args) {
                    if (this.bab && this.bab.token) args.push(this.bab.token);
                    return new Promise((resolve, reject) => {
                        google.script.run
                            .withSuccessHandler(r => resolve(r))
                            .withFailureHandler(e => {
                                const msg = (e && e.message) ? e.message : String(e);
                                if (isAuthError(msg)) {
                                    Object.assign(this.bab, { token: null, active: false, rows: [], baList: [], fBlok: '', ba: { open: false, kegiatanKey: null, tanggal: '', catatan: '', file: null, fileName: '', selected: {}, confirm: false } });
                                }
                                reject(msg);
                            })
                            [fn](...args);
                    });
                },
                dateOnly(v) {
                    if (!v) return '';
                    const s = String(v);
                    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
                    return m ? (m[1] + '-' + m[2] + '-' + m[3]) : '';
                },
                async babStart() {
                    if (!this.bab.kategori) { this.notify('Pilih kategori kegiatan terlebih dahulu.', false); return; }
                    if (this.bab.kategori === 'Praktikum' && !this.bab.subBagian) { this.notify('Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.', false); return; }
                    this.bab.loading = true;
                    try {
                        const res = await this.run('adminBagianBypass', this.bab.kategori, this.bab.subBagian);
                        if (!res || !res.ok) { this.notify((res && res.message) || 'Gagal memulai sesi bagian.', false); return; }
                        this.bab.token = res.token;
                        this.bab.nama = res.nama || 'Admin';
                        this.bab.active = true;
                        await this.babLoad();
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.bab.loading = false;
                    }
                },
                babEnd() {
                    if (this.bab.token) this.runAsBab('logoutSession', this.bab.token).catch(() => {});
                    Object.assign(this.bab, { kategori: '', subBagian: '', token: null, nama: '', active: false, rows: [], baList: [], fBlok: '', baSettings: { statuses: ['Diterima', 'ACC'], finalOnly: true }, ba: { open: false, kegiatanKey: null, tanggal: '', catatan: '', file: null, fileName: '', selected: {}, confirm: false } });
                    this.notify('Sesi bagian diakhiri.');
                },
                async babLoad() {
                    if (!this.bab.token) return;
                    this.bab.loading = true;
                    try {
                        const [bs, boot] = await Promise.all([
                            this.run('getBagianBaSettings'),
                            this.runAsBab('getBagianBootstrap', this.bab.kategori, this.bab.subBagian)
                        ]);
                        if (bs) this.bab.baSettings = Object.assign({ statuses: ['Diterima', 'ACC'], finalOnly: true }, bs);
                        if (!boot || !boot.ok) { this.notify((boot && boot.message) || 'Gagal memuat data bagian.', false); return; }
                        this.bab.rows = boot.rows || [];
                        this.bab.baList = boot.baList || [];
                    } catch (e) {
                        this.notify('Gagal memuat data: ' + e, false);
                    } finally {
                        this.bab.loading = false;
                    }
                },
                async babLoadBaList() {
                    try {
                        this.bab.baList = await this.runAsBab('getBeritaAcaraList', this.bab.subBagian || this.bab.kategori, this.bab.kategori) || [];
                    } catch (e) {
                        this.bab.baList = [];
                    }
                },
```

- [ ] **Step 4: Tambah computed `babLabOptions`**

Di dalam blok `computed:` (misal setelah `baBlokOptions` yang berakhir sebelum `statusChips`), tambahkan:

```js
                babLabOptions() {
                    return this.bagian.labs || [];
                },
```

- [ ] **Step 5: Perbarui `switchTab` dan `logout`**

Di `switchTab` (setelah baris 1166), tambahkan:

```js
                    if (tab === 'baBagian' && this.bab.active) this.babLoad();
```

Di `logout` (baris 1084-1093), ganti isi menjadi:

```js
                logout() {
                    if (this.bab && this.bab.token) this.runAsBab('logoutSession', this.bab.token).catch(() => {});
                    if (this.session && this.session.token) {
                        this.run('logoutSession', this.session.token).catch(() => {});
                    }
                    clearSession();
                    this.session = null;
                    this.loginPwd = '';
                    this.loginError = '';
                    this.bab.active = false;
                    this.bab.token = null;
                    this.bab.rows = [];
                    this.bab.baList = [];
                    this.loaded = { pengajuan: false, stats: false, bagian: false, ba: false, master: false };
                },
```

- [ ] **Step 6: Tambah section HTML (tahap 1 + kerangka sesi)**

Setelah section Laporan Bagian (`</section>` baris 429), sebelum komentar `<!-- ============ TAB: BERITA ACARA ============ -->` (baris 431), sisipkan:

```html
                <!-- ============ TAB: BERITA ACARA BAGIAN ============ -->
                <section v-if="tab==='baBagian'">
                    <div class="mb-5">
                        <h1 class="text-xl font-extrabold tracking-tight text-slate-900">Berita Acara Bagian</h1>
                        <p class="mt-0.5 text-sm text-slate-500">Isi berita acara atas nama bagian (tampil di Laporan Bagian &amp; Laporan Detail).</p>
                    </div>

                    <div v-if="!bab.active" class="mb-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                        <div class="grid gap-3 md:grid-cols-12">
                            <div class="md:col-span-4">
                                <label class="label">Kategori</label>
                                <select v-model="bab.kategori" class="input" @change="bab.subBagian=''">
                                    <option value="">(Pilih Kategori)</option>
                                    <option>SGD</option><option>KKD</option><option>Ujian</option><option>Praktikum</option>
                                </select>
                            </div>
                            <div v-if="bab.kategori==='Praktikum'" class="md:col-span-4">
                                <label class="label">Sub Bagian / Lab</label>
                                <select v-model="bab.subBagian" class="input">
                                    <option value="">(Pilih Lab)</option>
                                    <option v-for="l in babLabOptions" :value="l">{{ l }}</option>
                                </select>
                            </div>
                            <div class="md:col-span-4 flex items-end">
                                <button class="btn-primary w-full" :disabled="bab.loading" @click="babStart">
                                    <svg v-if="bab.loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                    <i v-else class="bi bi-play-circle"></i>
                                    Mulai Sesi Bagian
                                </button>
                            </div>
                        </div>
                        <p v-if="bab.kategori==='Praktikum' && !babLabOptions.length" class="mt-2 text-xs text-amber-600">Lab praktikum belum terisi di Master Data.</p>
                    </div>

                    <template v-else>
                        <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm ring-1 ring-brand-100">
                            <div class="min-w-0">
                                <div class="truncate font-semibold text-brand-800">{{ bab.kategori }}<template v-if="bab.subBagian"> / {{ bab.subBagian }}</template></div>
                                <div class="truncate text-xs text-slate-500">Sesi bagian sebagai {{ bab.nama }} (admin)</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button class="btn-soft !py-2 text-xs" :disabled="bab.loading" @click="babLoad"><i class="bi bi-arrow-clockwise"></i> Muat Ulang</button>
                                <button class="btn-danger-soft !py-2 text-xs" @click="babEnd"><i class="bi bi-box-arrow-right"></i> Akhiri Sesi</button>
                            </div>
                        </div>

                        <div v-if="bab.loading && !bab.rows.length" class="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-white py-12 text-slate-400 shadow-soft ring-1 ring-slate-100">
                            <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                            <span class="text-sm font-semibold">Memuat data bagian...</span>
                        </div>

                        <div v-else class="grid items-start gap-5 lg:grid-cols-2">
                            <!-- kegiatan + upload + daftar BA diisi Task 5 -->
                        </div>
                    </template>
                </section>
```

- [ ] **Step 7: Verifikasi sintaks halaman**

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
Expected: `extracted 1 inline scripts` (atau sesuai jumlah) dan `node --check` tanpa error (exit 0).

- [ ] **Step 8: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(ba-bagian): add dashboard tab scaffolding and bagian session"
```

---

### Task 5: Dashboard — kegiatan, upload BA, dan daftar BA

**Files:**
- Modify: `new-code1/pages/dashboard.html` — computed (blok computed), methods (blok methods), section HTML Task 4 (blok `grid items-start gap-5 lg:grid-cols-2`)

**Interfaces:**
- Consumes: state `this.bab` (dari Task 4); `runAsBab`, `dateOnly`, `readFileAsBase64`, `notify`, `statusBadge`, `formatTanggal`, `formatTanggalWaktu`.
- Produces: computed `babKegiatanGroups`, `babSelectedGroup`, `babSelectedCount`, `babSelectedList`, `babAllSelected`, `babBlokOptions`, `babFilteredRows`; methods `babOpenBaPicker`, `babCloseBaPicker`, `babSelectKegiatan`, `babBackToKegiatanPicker`, `babTogglePeserta`, `babToggleAllPeserta`, `babOnBaFile`, `babSubmitBa`, `babDoUploadBa`.

- [ ] **Step 1: Tambah computed**

Di dalam blok `computed:` (setelah `babLabOptions` dari Task 4), tambahkan:

```js
                babKegiatanGroups() {
                    const map = {};
                    const statuses = (this.bab.baSettings && this.bab.baSettings.statuses) || ['Diterima', 'ACC'];
                    const finalOnly = !(this.bab.baSettings && this.bab.baSettings.finalOnly === false);
                    (this.bab.rows || []).forEach(r => {
                        const key = [r.jenis, r.pilihan, r.detail, r.tanggal, r.blok].join('|');
                        if (!map[key]) {
                            map[key] = { key: key, jenis: r.jenis, pilihan: r.pilihan, detail: r.detail, tanggal: r.tanggal, blok: r.blok, label: 'Blok ' + r.blok + ' · ' + r.pilihan + (r.detail ? ' - ' + r.detail : ''), peserta: [], statusCounts: {}, blocked: false };
                        }
                        const g = map[key];
                        g.statusCounts[r.status] = (g.statusCounts[r.status] || 0) + 1;
                        if (statuses.indexOf(r.status) !== -1) {
                            g.peserta.push({ idPengajuan: r.idPengajuan, npm: r.npm, namaLengkap: r.namaLengkap, blok: r.blok, statusPengajuan: r.status });
                        }
                        if (finalOnly && r.status === 'Menunggu') g.blocked = true;
                    });
                    const out = Object.values(map).filter(g => !g.blocked && g.peserta.length > 0);
                    out.forEach(g => { g.statusOrder = Object.keys(g.statusCounts); });
                    return out;
                },
                babSelectedGroup() {
                    if (!this.bab.ba.kegiatanKey) return null;
                    return this.babKegiatanGroups.find(g => g.key === this.bab.ba.kegiatanKey) || null;
                },
                babSelectedCount() {
                    return Object.keys(this.bab.ba.selected).filter(k => this.bab.ba.selected[k]).length;
                },
                babSelectedList() {
                    if (!this.babSelectedGroup) return [];
                    return this.babSelectedGroup.peserta.filter(p => !!this.bab.ba.selected[p.idPengajuan]);
                },
                babAllSelected() {
                    const list = this.babSelectedGroup ? this.babSelectedGroup.peserta : [];
                    return list.length > 0 && list.every(p => !!this.bab.ba.selected[p.idPengajuan]);
                },
                babBlokOptions() {
                    const seen = {};
                    const out = [];
                    (this.bab.rows || []).forEach(r => {
                        const b = String(r.blok || '').trim();
                        if (b && !seen[b]) { seen[b] = true; out.push(b); }
                    });
                    return out.sort();
                },
                babFilteredRows() {
                    if (!this.bab.fBlok) return this.bab.rows;
                    return this.bab.rows.filter(r => String(r.blok || '').trim() === this.bab.fBlok);
                },
```

- [ ] **Step 2: Tambah methods**

Setelah `babLoadBaList` (dari Task 4), tambahkan:

```js
                babOpenBaPicker() {
                    this.bab.ba.open = true;
                    this.bab.ba.kegiatanKey = null;
                    this.bab.ba.selected = {};
                    this.bab.ba.tanggal = '';
                    this.bab.ba.catatan = '';
                    this.bab.ba.file = null;
                    this.bab.ba.fileName = '';
                    this.bab.ba.confirm = false;
                },
                babCloseBaPicker() {
                    this.bab.ba.open = false;
                    this.bab.ba.kegiatanKey = null;
                    this.bab.ba.selected = {};
                    this.bab.ba.confirm = false;
                },
                babSelectKegiatan(key) {
                    const g = this.babKegiatanGroups.find(x => x.key === key);
                    if (!g) return;
                    this.bab.ba.kegiatanKey = key;
                    this.bab.ba.selected = {};
                    this.bab.ba.tanggal = this.dateOnly(g.tanggal);
                },
                babBackToKegiatanPicker() {
                    this.bab.ba.kegiatanKey = null;
                    this.bab.ba.selected = {};
                    this.bab.ba.confirm = false;
                },
                babTogglePeserta(id) {
                    this.bab.ba.selected[id] = !this.bab.ba.selected[id];
                },
                babToggleAllPeserta() {
                    if (!this.babSelectedGroup) return;
                    const target = !this.babAllSelected;
                    this.babSelectedGroup.peserta.forEach(p => { this.bab.ba.selected[p.idPengajuan] = target; });
                },
                babOnBaFile(e) {
                    this.bab.ba.file = e.target.files && e.target.files.length ? e.target.files[0] : null;
                    this.bab.ba.fileName = this.bab.ba.file ? this.bab.ba.file.name : '';
                },
                babSubmitBa() {
                    if (!this.babSelectedGroup) { this.notify('Pilih kegiatan terlebih dahulu.', false); return; }
                    if (!this.babSelectedList.length) { this.notify('Pilih minimal satu peserta.', false); return; }
                    if (!this.bab.ba.file) { this.notify('Pilih file berita acara terlebih dahulu.', false); return; }
                    if (!this.bab.ba.tanggal) { this.notify('Isi tanggal pelaksanaan terlebih dahulu.', false); return; }
                    this.bab.ba.confirm = true;
                },
                async babDoUploadBa() {
                    if (this.loading) return;
                    this.bab.ba.confirm = false;
                    this.loading = true;
                    try {
                        const payload = {
                            namaKegiatan: this.babSelectedGroup.pilihan + (this.babSelectedGroup.detail ? ' - ' + this.babSelectedGroup.detail : ''),
                            tanggalPelaksanaan: this.bab.ba.tanggal,
                            blok: this.babSelectedGroup.blok,
                            catatan: this.bab.ba.catatan.trim(),
                            bagian: this.bab.subBagian || this.bab.kategori,
                            peserta: this.babSelectedList,
                            file: await this.readFileAsBase64(this.bab.ba.file)
                        };
                        const res = await this.runAsBab('uploadBeritaAcaraBagian', payload, this.bab.kategori);
                        this.notify((res && res.message) || 'Selesai.', !!(res && res.success));
                        if (res && res.success) {
                            this.babCloseBaPicker();
                            const fileEl = document.querySelector('input[type=file]');
                            if (fileEl) fileEl.value = '';
                            await this.babLoadBaList();
                        }
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.loading = false;
                    }
                },
```

- [ ] **Step 3: Isi bagian tengah section (Task 4 placeholder)**

Ganti placeholder di section `baBagian`:

```html
                        <div v-else class="grid items-start gap-5 lg:grid-cols-2">
                            <!-- kegiatan + upload + daftar BA diisi Task 5 -->
                        </div>
```

menjadi:

```html
                        <div v-else class="grid items-start gap-5 lg:grid-cols-2">
                            <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                                <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
                                    <h2 class="text-sm font-bold text-slate-900">Kegiatan Bagian</h2>
                                    <div class="ml-auto flex flex-wrap gap-1.5">
                                        <button class="rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset" :class="bab.fBlok==='' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-slate-200'" @click="bab.fBlok=''">Semua</button>
                                        <button v-for="b in babBlokOptions" :key="b" class="rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset" :class="bab.fBlok===b ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-slate-200'" @click="bab.fBlok=b">{{ b }}</button>
                                    </div>
                                </div>
                                <div v-if="!babFilteredRows.length" class="px-4 py-12 text-center text-sm text-slate-400">Tidak ada data kegiatan.</div>
                                <div v-else class="divide-y divide-slate-50">
                                    <div v-for="r in babFilteredRows" :key="r.idPengajuan" class="flex items-start gap-3 p-4">
                                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><i class="bi bi-person"></i></div>
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-start justify-between gap-2">
                                                <div class="min-w-0">
                                                    <div class="truncate text-sm font-bold text-slate-900">{{ r.namaLengkap }}</div>
                                                    <div class="font-mono text-[11px] text-slate-400">NPM {{ r.npm }}</div>
                                                </div>
                                                <span class="shrink-0" :class="statusBadge(r.status)">{{ r.status || '-' }}</span>
                                            </div>
                                            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                                <span class="flex items-center gap-1"><i class="bi bi-grid"></i>{{ r.blok }}</span>
                                                <span class="flex items-center gap-1"><i class="bi bi-calendar3"></i>{{ formatTanggal(r.tanggal) }}</span>
                                            </div>
                                            <div class="mt-1 text-xs text-slate-600">{{ r.pilihan }}<template v-if="r.detail"> - {{ r.detail }}</template></div>
                                            <a v-if="r.linkSurat" :href="r.linkSurat" target="_blank" class="link mt-1.5 inline-block text-xs"><i class="bi bi-file-earmark-text"></i> Lihat Surat</a>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-5">
                                <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                                    <div class="border-b border-slate-100 p-4">
                                        <h2 class="text-sm font-bold text-slate-900">Upload Berita Acara</h2>
                                        <p class="text-xs text-slate-400">Pilih kegiatan &amp; centang peserta yang hadir</p>
                                    </div>
                                    <div class="p-4">
                                        <button v-if="!bab.ba.open" class="btn-primary w-full" @click="babOpenBaPicker"><i class="bi bi-plus-circle"></i> Buat Berita Acara</button>
                                        <div v-else class="space-y-3">
                                            <div v-if="!babSelectedGroup">
                                                <label class="label">Pilih Kegiatan ({{ (bab.baSettings.statuses || ['Diterima','ACC']).join(' / ') }})</label>
                                                <div v-if="!babKegiatanGroups.length" class="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Tidak ada kegiatan yang bisa dibuatkan berita acara.</div>
                                                <div v-else class="space-y-2">
                                                    <button v-for="g in babKegiatanGroups" :key="g.key" class="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40" @click="babSelectKegiatan(g.key)">
                                                        <div class="flex items-center justify-between gap-2">
                                                            <span class="text-sm font-bold text-slate-800">{{ g.label }}</span>
                                                            <span class="text-[11px] font-semibold text-brand-600">{{ g.peserta.length }} mhs</span>
                                                        </div>
                                                        <div class="mt-1.5 flex flex-wrap gap-1">
                                                            <span v-for="s in g.statusOrder" :key="s" class="rounded-md px-1.5 py-0.5 text-[10px] font-bold" :class="statusBadge(s)">{{ g.statusCounts[s] }} {{ s }}</span>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                            <div v-else>
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
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div><label class="label">Tanggal Pelaksanaan</label><input v-model="bab.ba.tanggal" type="date" class="input"></div>
                                                    <div>
                                                        <label class="label">File BA (PDF / JPG / PNG)</label>
                                                        <div class="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3">
                                                            <i class="bi bi-cloud-arrow-up text-xl text-brand-400"></i>
                                                            <div class="min-w-0 flex-1 truncate text-xs text-slate-500">
                                                                <span v-if="!bab.ba.file">Pilih file...</span>
                                                                <span v-else class="font-semibold text-slate-700">{{ bab.ba.fileName }}</span>
                                                            </div>
                                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="max-w-[120px] text-xs" @change="babOnBaFile">
                                                        </div>
                                                    </div>
                                                    <div class="sm:col-span-2"><label class="label">Catatan <span class="font-normal text-slate-400">(opsional)</span></label><textarea v-model="bab.ba.catatan" rows="2" class="input"></textarea></div>
                                                </div>
                                                <div class="flex gap-2">
                                                    <button class="btn-soft flex-1" @click="babBackToKegiatanPicker"><i class="bi bi-arrow-left"></i> Ganti Kegiatan</button>
                                                    <button class="btn-primary flex-1" @click="babSubmitBa"><i class="bi bi-check2"></i> Lanjut</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                                    <div class="border-b border-slate-100 p-4">
                                        <h2 class="text-sm font-bold text-slate-900">Berita Acara Terunggah</h2>
                                        <p class="text-xs text-slate-400">{{ bab.baList.length }} berita acara</p>
                                    </div>
                                    <div v-if="!bab.baList.length" class="px-4 py-10 text-center text-sm text-slate-400">Belum ada berita acara untuk bagian ini.</div>
                                    <div v-else class="divide-y divide-slate-50">
                                        <div v-for="(r, i) in bab.baList" :key="i" class="p-4">
                                            <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                                <span class="font-mono">{{ r['BA ID'] }}</span>
                                                <span>·</span>
                                                <span>{{ formatTanggal(r.Timestamp) }}</span>
                                            </div>
                                            <div class="mt-1 text-sm font-bold text-slate-900">{{ r.Blok }} · {{ r['Nama Kegiatan'] }}</div>
                                            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                <i class="bi bi-calendar3"></i><span>{{ formatTanggalWaktu(r['Tanggal Pelaksanaan']) }}</span>
                                                <span class="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600"><i class="bi bi-people"></i> {{ r['Jumlah Peserta'] }} peserta</span>
                                            </div>
                                            <div v-if="r.peserta && r.peserta.length" class="mt-2 flex flex-wrap gap-1.5">
                                                <span v-for="(p, j) in r.peserta" :key="j" class="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                                                    <i class="bi bi-person"></i>{{ p.namaLengkap }}
                                                </span>
                                            </div>
                                            <a v-if="r['File URL']" :href="r['File URL']" target="_blank" class="link mt-2 inline-block text-xs"><i class="bi bi-eye"></i> Lihat File</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="bab.ba.confirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" @click="bab.ba.confirm=false"></div>
                            <transition name="pop" appear>
                                <div class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-lift">
                                    <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                        <h3 class="text-sm font-bold text-slate-900">Konfirmasi Upload</h3>
                                        <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" @click="bab.ba.confirm=false"><i class="bi bi-x-lg"></i></button>
                                    </div>
                                    <div class="px-6 py-4">
                                        <div class="mb-3 text-sm font-bold text-slate-800">{{ babSelectedGroup.label }}</div>
                                        <div class="mb-3 text-xs text-slate-500">{{ babSelectedList.length }} peserta dipilih · Tanggal {{ formatTanggal(bab.ba.tanggal) }}</div>
                                        <div class="max-h-52 space-y-1.5 overflow-y-auto">
                                            <div v-for="p in babSelectedList" :key="p.idPengajuan" class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5">
                                                <div class="min-w-0">
                                                    <div class="truncate text-xs font-bold text-slate-800">{{ p.namaLengkap }}</div>
                                                    <div class="font-mono text-[10px] text-slate-400">{{ p.npm }}</div>
                                                </div>
                                                <span class="shrink-0 text-[10px]" :class="statusBadge(p.statusPengajuan)">{{ p.statusPengajuan }}</span>
                                            </div>
                                        </div>
                                        <div v-if="bab.ba.fileName" class="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700"><i class="bi bi-file-earmark-pdf"></i>{{ bab.ba.fileName }}</div>
                                    </div>
                                    <div class="flex justify-end gap-2 border-t border-slate-100 px-6 py-3.5">
                                        <button class="btn-soft" @click="bab.ba.confirm=false">Batal</button>
                                        <button class="btn-primary" :disabled="loading" @click="babDoUploadBa">
                                            <svg v-if="loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                            </svg>
                                            <i v-else class="bi bi-upload"></i>
                                            Unggah Berita Acara
                                        </button>
                                    </div>
                                </div>
                            </transition>
                        </div>
```

- [ ] **Step 4: Verifikasi sintaks halaman**

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

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(ba-bagian): kegiatan picker, BA upload, and BA list in dashboard tab"
```

---

### Task 6: Verifikasi lintas-file (gabungan)

**Files:**
- Review: `new-code1/0_code.gs`, `new-code1/1_business.gs`, `new-code1/pages/dashboard.html`

- [ ] **Step 1: Verifikasi sintaks semua file**

```bash
cp new-code1/0_code.gs /tmp/opencode/check/0_code.js
cp new-code1/1_business.gs /tmp/opencode/check/1_business.js
node --check /tmp/opencode/check/0_code.js
node --check /tmp/opencode/check/1_business.js
python3 - <<'PY'
import re
html = open('new-code1/pages/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/dashboard_inline.js
```
Expected: semua `node --check` exit 0 tanpa output.

- [ ] **Step 2: Cek tidak ada referensi sheet lama yang terlewat**

```bash
grep -n "BeritaAcara" new-code1/1_business.gs
```
Expected: referensi `'BeritaAcara'` hanya di fungsi bagian/laporan (uploadBeritaAcaraBagian, _getBaPesertaMap, _computeBaList, getBeritaAcaraList, getDashboardStats/_computeDashboardStats, _computeBagianAggregation, getLaporanBootstrap, getBagianBootstrap) dan di `getDashboardBootstrap` hanya untuk `stats`/`bagian` (bukan untuk field `beritaAcara`). Referensi `'BeritaAcaraAdmin'`/`'BeritaAcaraAdminPeserta'` hanya di fungsi admin (uploadBeritaAcaraAdmin, getBeritaAcaraAdminList, deleteBeritaAcaraAdmin, getDashboardBootstrap untuk field `beritaAcara`, _getBaPesertaMapAdmin). Tidak ada fungsi bagian yang membaca `BeritaAcaraAdmin` dan tidak ada fungsi admin yang menulis `BeritaAcara`.

- [ ] **Step 3: Cek konsistensi nama method/computed di dashboard**

```bash
grep -n "babStart\|babEnd\|babLoad\|babLoadBaList\|babOpenBaPicker\|babCloseBaPicker\|babSelectKegiatan\|babBackToKegiatanPicker\|babTogglePeserta\|babToggleAllPeserta\|babOnBaFile\|babSubmitBa\|babDoUploadBa\|babKegiatanGroups\|babSelectedGroup\|babSelectedList\|babAllSelected\|babBlokOptions\|babFilteredRows\|babLabOptions\|runAsBab" new-code1/pages/dashboard.html
```
Expected: setiap nama muncul minimal 2 kali (definisi method/computed + pemakaian di template) atau sekali di definisi — pastikan tidak ada pemanggilan tanpa definisi.

- [ ] **Step 4: Review ringkas perubahan**

```bash
git status
git log --oneline -6
```
Expected: 5 commit dari Task 1-5 ada di log; working tree bersih (kecuali `new-code1/` dan `_backup-archive/` yang tidak di-track).

---

## Catatan Pengujian Manual (setelah deploy)

1. Redeploy dengan "Version: New version" + jalankan `setupDatabase()` → sheet `BeritaAcaraAdmin` & `BeritaAcaraAdminPeserta` dibuat; baris `Sumber='Admin'` lama di `BeritaAcara`/`BeritaAcaraPeserta` dipindah ke sheet baru.
2. Login dashboard → tab **Berita Acara Bagian** → pilih kategori (Praktikum → pilih lab) → **Mulai Sesi Bagian** → verifikasi daftar kegiatan & "Buat Berita Acara" → pilih kegiatan → centang peserta → tanggal → file → **Lanjut** → konfirmasi → upload.
3. Cek sheet `BeritaAcara`: baris baru `Sumber='Bagian'`, `Bagian` = `subBagian || kategori`. Cek detail-laporan & Laporan Bagian: BA baru muncul.
4. Tab **Berita Acara** (dashboard): upload BA → cek masuk sheet `BeritaAcaraAdmin` (`Sumber='Admin'`), tidak muncul di detail-laporan.
5. **Akhiri Sesi** → token bagian dihancurkan; `logout()` dashboard juga menghancurkan token bagian.
