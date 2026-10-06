# Optimasi Loading Dashboard (`dashboard.html`) — T1–T3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mempercepat loading data halaman `dashboard.html` lewat tiga perubahan: (T1) memakai `getAllRowsCached` untuk sheet berat di seluruh jalur baca tampilan (read-only display) sehingga RPC berulang tidak membaca ulang Sheets; (T2) menggabungkan `getDosenOptions` ke dalam payload `getDashboardBootstrap` sehingga login hanya 1 RPC; (T3) menjadikan tab **Laporan Bagian** dan **Berita Acara** benar-benar lazy (dimuat on-demand saat tab pertama dibuka), sehingga login tidak lagi memuat/menghitung data yang belum dibutuhkan.

**Architecture:** Semua optimasi backend ada di `1_business.gs` dengan memanfaatkan layer cache yang sudah ada (`getAllRowsCached` + `invalidateSheetCache`, `0_code.gs:316`/`309`). Caching hanya diterapkan pada jalur **baca-tampilan**; jalur tulis/validasi (duplicate check, status update, delete, email) **tetap `getAllRows`** agar tidak membaca data basi. Sisi client (`dashboard.html`): `bootstrap()` memakai langsung `b.dosen`, berhenti meng-eager-load data `bagian`/`ba`, dan `switchTab()` memicu lazy-load (mekanisme `loaded.*` yang sudah ada).

**Tech Stack:** Google Apps Script (server), Vue 3 CDN + Tailwind inline (client).

## Global Constraints

- Hanya **dua file** yang diubah: `new-code1/1_business.gs` dan `new-code1/pages/dashboard.html`. `0_code.gs` TIDAK diubah (`getAllRowsCached` default TTL 45 detik sudah ada).
- **Kontrak output TETAP identik** (sebelum vs sesudah) untuk: `getDashboardStats`, `getPengajuanList`, `getBagianAggregation`, `getBeritaAcaraAdminList`, `getPengajuanWithDetails`, `getBaUploadOptions`, `getBeritaAcaraList` (via `_computeBaList`), `getBagianBootstrap` (via `_computeBagianRows`).
- **`getDashboardBootstrap` kontrak BERUBAH secara sengaja**: (T3) menghapus field `bagian` dan `beritaAcara`; (T2) menambah field `dosen`. Frontend diperbarui di cabang yang sama, jadi aman.
- **Aturan keamanan cache**: caching HANYA untuk jalur read-only display. Jalur tulis/validasi berikut TETAP `getAllRows` (jangan dicache): `checkDuplicatePengajuan` (`:321`), `_getPengajuanDetailSummary` (`:453`), `uploadBeritaAcaraBagian` duplicate check (`:1181`), `_validateBaPesertaStatus` (`:1136`), `deleteBeritaAcaraAdmin` (`:1682`), `_resolveBaPesertaFromDetail` (`:2487`), `sendBulkFinalEmail` (`:2786`), `diagnosticData` (`:818`, dibiarkan segar agar diagnostik akurat).
- **Staleness ≤ 45 detik diterima** hanya untuk perubahan data di luar aplikasi (edit manual Sheets). Semua write di dalam aplikasi sudah memanggil `invalidateSheetCache` (via `appendRowSafe`/`upsertRowByKey`/`deleteRowByKey`), sehingga baca berikutnya selalu segar.
- `getLaporanBootstrap` (`detail-laporan.html`, `:1476-1481`) TIDAK diubah — halaman terpisah, sudah dioptimasi sendiri, dan membaca segar agar badge waktu load-nya akurat.
- TTL: `getAllRowsCached('...')` tanpa argumen TTL → default 45 detik. Nilai TTL yang sudah ada (`MasterKegiatan` 300, `Config`/`CheckData`/`BagianStaff` 60) tidak diubah.
- Nama cabang: `feat/dashboard-loading-optimasi` dari `feat/laporan-dosen-matriks`.

---

### Task 1: Cache sheet berat di jalur baca-tampilan (`1_business.gs`)

**Files:**
- Modify: `new-code1/1_business.gs` — 14 lokasi (lihat tabel di bawah). Tidak ada perubahan struktur/ekspor; hanya menukar `getAllRows('X')` → `getAllRowsCached('X')`.

**Interfaces:**
- Consumes: `getAllRowsCached(sheetName, ttlSeconds?)` (`0_code.gs:316`, default TTL 45), `invalidateSheetCache` (`0_code.gs:309`) — sudah ada, tidak diubah.
- Produces: fungsi API yang sama persis, dengan baca sheet berat memakai cache. Kontrak output tidak berubah.

- [ ] **Step 1: Lihat semua lokasi yang akan diubah**

Lokasi & penggantian (fungsi → baris → perubahan tepat):

| # | Fungsi | Baris | `getAllRows(...)` → `getAllRowsCached(...)` |
|---|---|---|---|
| 1 | `_getBaPesertaMap` | `:1233` | `'BeritaAcaraPeserta'` |
| 2 | `_getBaPesertaMapAdmin` | `:1248` | `'BeritaAcaraAdminPeserta'` |
| 3 | `_computeBaList` | `:1262` | `'BeritaAcara'` |
| 4 | `getDashboardStats` | `:1335-1337` | `'Pengajuan'`, `'DetailKegiatan'`, `'BeritaAcara'` |
| 5 | `getPengajuanList` | `:1405` | `'Pengajuan'` |
| 6 | `getDashboardBootstrap` | `:1437-1439, 1447` | `'Pengajuan'`, `'DetailKegiatan'`, `'BeritaAcara'`, `'BeritaAcaraAdmin'` |
| 7 | `getPengajuanWithDetails` | `:613` | `'DetailKegiatan'` |
| 8 | `_computeBagianRows` | `:1050-1051` | `'Pengajuan'`, `'DetailKegiatan'` |
| 9 | `getBagianAggregation` | `:1585` | `'Pengajuan'`, `'DetailKegiatan'`, `'BeritaAcara'` |
| 10 | `getBeritaAcaraAdminList` | `:1660` | `'BeritaAcaraAdmin'` |
| 11 | `getBaUploadOptions` | `:2424-2425` | `'Pengajuan'`, `'DetailKegiatan'` |
| 12 | `_getBiayaMap` | `:2326` | `'MasterBiaya'` |

Contoh penggantian (pola sama di semua lokasi; `getAllRows('Pengajuan')` menjadi `getAllRowsCached('Pengajuan')`):

```js
// SEBELUM (mis. getDashboardStats, :1335)
        getAllRows('Pengajuan'),
        getAllRows('DetailKegiatan'),
        getAllRows('BeritaAcara'),
// SESUDAH
        getAllRowsCached('Pengajuan'),
        getAllRowsCached('DetailKegiatan'),
        getAllRowsCached('BeritaAcara'),
```

- [ ] **Step 2: Terapkan semua penggantian di `new-code1/1_business.gs`**

Tukar 14 `getAllRows('X')` → `getAllRowsCached('X')` sesuai tabel Step 1. JANGAN menyentuh baris di luar tabel (terutama yang di Global Constraints: `:321`, `:453`, `:818`, `:1136`, `:1181`, `:1682`, `:2487`, `:2786`).

- [ ] **Step 3: Verifikasi sintaks file GAS**

```bash
mkdir -p /tmp/opencode/check
cp new-code1/1_business.gs /tmp/opencode/check/business.gs.js
node --check /tmp/opencode/check/business.gs.js
```

Expected: exit 0 tanpa output.

- [ ] **Step 4: Verifikasi cakupan cache (jalur tampilan tercache, jalur tulis tetap segar)**

```bash
# Jalur display WAJIB sudah pakai getAllRowsCached
rg -n "getAllRowsCached\('(Pengajuan|DetailKegiatan|BeritaAcara|BeritaAcaraPeserta|BeritaAcaraAdmin|BeritaAcaraAdminPeserta|MasterBiaya)'" new-code1/1_business.gs
```

Expected: muncul di baris `613, 1050, 1051, 1233, 1248, 1262, 1335, 1336, 1337, 1405, 1437, 1438, 1439, 1447, 1585, 1660, 2326, 2424, 2425`.

```bash
# Jalur tulis/validasi WAJIB TETAP getAllRows (tidak tercache)
rg -n "getAllRows\('(Pengajuan|DetailKegiatan|BeritaAcara|BeritaAcaraPeserta|BeritaAcaraAdmin|BeritaAcaraAdminPeserta)'\)" new-code1/1_business.gs
```

Expected: hanya baris di dalam fungsi tulis/validasi yang dikecualikan, yaitu `321, 322, 453, 719, 720, 818, 1136, 1181, 1478, 1479, 1481, 1682, 1906, 2487, 2498, 2786`. (Catatan: `719/720` = `getStudentPortalData`, `1478-1481` = `getLaporanBootstrap`, `1906` = `_getPengajuanDetails` — semuanya di luar cakupan T1 dan sengaja dibiarkan.)

- [ ] **Step 5: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "perf(dashboard): cache heavy sheet reads on read-only API paths"
```

---

### Task 2: Gabung `getDosenOptions` ke payload `getDashboardBootstrap`

**Files:**
- Modify: `new-code1/1_business.gs` — `getDashboardBootstrap` return (`:1462-1473`).
- Modify: `new-code1/pages/dashboard.html` — `bootstrap()` (`:1811-1842`) dan hapus method `loadDosenOptions` (`:1915-1920`).

**Interfaces:**
- Consumes: `getMasterOptions('Dosen')` (`1_business.gs:559`, cache `MasterKegiatan` TTL 300 — sudah ada).
- Produces: `getDashboardBootstrap` menambah field `dosen: string[]` (additive, tidak memecah field lain). Frontend mengisi `this.dosenOptions` dari payload; method `loadDosenOptions` dihapus.

- [ ] **Step 1: Tambah field `dosen` di return `getDashboardBootstrap`**

Di `new-code1/1_business.gs`, pada object return `getDashboardBootstrap` (mulai baris 1462), tambah `dosen` tepat setelah `masterBiaya`:

```js
    return {
        stats: _computeDashboardStats(pengajuan, details, ba, biayaMap, overrideMap),
        pengajuan: _buildPengajuanClientRows(sortedPengajuan, biayaMap, overrideMap),
        detailMap: detailMap,
        masterBiaya: masterBiaya,
        dosen: getMasterOptions('Dosen'),
        bagian: _computeBagianAggregation(pengajuan, details, ba),
        beritaAcara: adminBa.map(function(r) {
            const c = _clientRow(r);
            c.peserta = adminBaPesertaMap[String(r['BA ID'] || '').trim()] || [];
            return c;
        })
    };
```

- [ ] **Step 2: Konsumsi `b.dosen` di `bootstrap()` dan hapus panggilan `loadDosenOptions`**

Di `new-code1/pages/dashboard.html`, `bootstrap()` baris 1821 tambah satu baris setelah `this.masterBiaya = b.masterBiaya || [];`:

```js
                        this.dosenOptions = b.dosen || this.dosenOptions;
```

Hapus baris terakhir `bootstrap()` (baris 1841):

```js
                    this.loadDosenOptions();
```

- [ ] **Step 3: Hapus method `loadDosenOptions` (dead code)**

Hapus seluruh method (baris 1915-1920):

```js
                async loadDosenOptions() {
                    if (this.dosenOptions.length) return;
                    try {
                        this.dosenOptions = await this.run('getDosenOptions') || [];
                    } catch (e) { /* non-blokir */ }
                },
```

- [ ] **Step 4: Verifikasi sintaks inline script dashboard**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/dashboard_inline.js
```

Expected: exit 0 tanpa output.

- [ ] **Step 5: Verifikasi tidak ada referensi `loadDosenOptions` tersisa**

```bash
rg -n "loadDosenOptions|getDosenOptions" new-code1/pages/dashboard.html new-code1/1_business.gs || echo "OK: tidak ada referensi tersisa"
```

Expected: output `OK: tidak ada referensi tersisa` (di kedua file; fungsi `getDosenOptions` di `1_business.gs` tetap ada dan tidak dihapus karena bisa dipakai halaman lain di masa depan — pastikan rg hanya menemukan definisi `function getDosenOptions()` di `1_business.gs:559`).

- [ ] **Step 6: Commit**

```bash
git add new-code1/1_business.gs new-code1/pages/dashboard.html
git commit -m "feat(dashboard): merge dosen options into bootstrap payload to cut an RPC"
```

---

### Task 3: Lazy-load tab `bagian` & `ba` (backend + frontend)

**Files:**
- Modify: `new-code1/1_business.gs` — `getDashboardBootstrap` (`:1442, 1447`, return `:1462-1473`).
- Modify: `new-code1/pages/dashboard.html` — `bootstrap()` (`:1811-1842`), `switchTab()` (`:1799-1808`).

**Interfaces:**
- Consumes: `getBagianAggregation()` (`:1583`, sudah dicache di Task 1), `getBeritaAcaraAdminList()` (`:1658`, sudah dicache di Task 1), `getLabOptions()` (`:558`), flag `loaded.bagian` / `loaded.ba` (sudah ada), `sectionLoading.*` (sudah ada).
- Produces: `getDashboardBootstrap` TIDAK lagi mengembalikan field `bagian` dan `beritaAcara`; variabel lokal `adminBa` (`:1447`) dan `adminBaPesertaMap` (`:1442`) dihapus. Frontend memuat `bagian`/`ba` on-demand via `loadBagian()`/`loadBa()`.

- [ ] **Step 1: Hapus field `bagian` & `beritaAcara` dari return `getDashboardBootstrap`**

Di `new-code1/1_business.gs`, ganti blok return `getDashboardBootstrap` (baris 1462-1473) menjadi:

```js
    return {
        stats: _computeDashboardStats(pengajuan, details, ba, biayaMap, overrideMap),
        pengajuan: _buildPengajuanClientRows(sortedPengajuan, biayaMap, overrideMap),
        detailMap: detailMap,
        masterBiaya: masterBiaya,
        dosen: getMasterOptions('Dosen')
    };
```

- [ ] **Step 2: Hapus baca `BeritaAcaraAdmin` + `_getBaPesertaMapAdmin` yang kini tak terpakai di bootstrap**

Di `new-code1/1_business.gs`, hapus dua baris (1442 dan 1447):

```js
    const adminBaPesertaMap = _getBaPesertaMapAdmin();
```

```js
    const adminBa = getAllRowsCached('BeritaAcaraAdmin').slice().sort(function(a, b) { return String(b.Timestamp || '').localeCompare(String(a.Timestamp || '')); });
```

Catatan: `_getBaPesertaMapAdmin` (definisi `:1246`) TIDAK dihapus — masih dipakai `getBeritaAcaraAdminList` (`:1664`).

- [ ] **Step 3: Ringkas `bootstrap()` di `dashboard.html`**

Ganti seluruh method `bootstrap()` (baris 1811-1842) menjadi:

```js
                async bootstrap() {
                    this.sectionLoading.pengajuan = true;
                    this.sectionLoading.stats = true;
                    try {
                        const b = await this.run('getDashboardBootstrap');
                        this.stats = b.stats || this.stats;
                        this.pengajuanRows = (b.pengajuan || []).map(r => Object.assign({}, r, { checked: false }));
                        this.detailMap = b.detailMap || {};
                        this.masterBiaya = b.masterBiaya || [];
                        this.dosenOptions = b.dosen || this.dosenOptions;
                        this.loaded.pengajuan = true;
                        this.loaded.stats = true;
                    } catch (e) {
                        this.notify('Gagal memuat dashboard: ' + e, false);
                    } finally {
                        this.sectionLoading.pengajuan = false;
                        this.sectionLoading.stats = false;
                    }
                },
```

Yang dihapus dari bootstrap lama: assignment `bagian.all/labs/options/bloks`, `applyBagianFilter()`, `ba.all`, `applyBaFilter()`, `loaded.bagian`, `loaded.ba`, `sectionLoading.bagian`, `sectionLoading.ba`.

- [ ] **Step 4: `switchTab` memicu lazy-load `bagian` saat tab `baBagian` dibuka**

Di `new-code1/pages/dashboard.html`, `switchTab()` (baris 1799-1808) tambahkan satu baris setelah baris `if (tab === 'baBagian' && this.bab.active) this.babLoad();`:

```js
                    if (tab === 'baBagian' && !this.loaded.bagian && !this.bagian.labs.length) this.loadBagian();
```

Hasil akhir `switchTab()`:

```js
                switchTab(tab) {
                    this.tab = tab;
                    this.sidebarOpen = false;
                    if (tab === 'pengajuan' && !this.loaded.pengajuan) this.loadPengajuan();
                    if (tab === 'stats' && !this.loaded.stats) this.loadStats();
                    if (tab === 'bagian' && !this.loaded.bagian) this.loadBagian();
                    if (tab === 'ba' && !this.loaded.ba) this.loadBa();
                    if (tab === 'master' && !this.loaded.master) this.loadMaster();
                    if (tab === 'baBagian' && this.bab.active) this.babLoad();
                    if (tab === 'baBagian' && !this.loaded.bagian && !this.bagian.labs.length) this.loadBagian();
                },
```

Alasan: tab `baBagian` membutuhkan `bagian.labs` untuk dropdown "Sub Bagian / Lab" saat kategori `Praktikum` (`babLabOptions`, `:1338`). `loadBagian()` (`:1867`) mengisi `labs` dari `getBagianAggregation()` (sudah dicache di Task 1 sehingga murah). `loaded.bagian` tetap di-set sehingga tab **Laporan Bagian** nantinya tampil instan.

- [ ] **Step 5: Verifikasi sintaks inline script dashboard**

```bash
node --check /tmp/opencode/check/dashboard_inline.js
```

(File sudah diekstrak di Task 2 Step 4. Jika belum ada, jalankan ulang ekstraksi dari Task 2.)

Expected: exit 0 tanpa output.

- [ ] **Step 6: Verifikasi bootstrap tidak lagi eager-load bagian/ba**

```bash
rg -n "b\.bagian|b\.beritaAcara|applyBagianFilter|applyBaFilter|loaded\.bagian|loaded\.ba|sectionLoading\.bagian|sectionLoading\.ba" new-code1/pages/dashboard.html
```

Expected: hasil hanya dari `loadBagian`/`loadBa`/`switchTab` (baris 1803, 1804, 1875, 1891, plus baris baru `baBagian`), TIDAK ada di dalam `bootstrap()`. Jika masih ada referensi di bootstrap, perbaiki sebelum commit.

- [ ] **Step 7: Verifikasi backend tidak lagi mengirim `bagian`/`beritaAcara`**

```bash
rg -n "bagian:|beritaAcara:|adminBa" new-code1/1_business.gs
```

Expected: TIDAK ada kecocokan `bagian:` / `beritaAcara:` sebagai property return bootstrap; `adminBa` hanya muncul di fungsi lain (mis. `getBeritaAcaraAdminList` tidak memakai `adminBa`; `adminBaPesertaMap` hanya di `:1442` — pastikan sudah terhapus). Sisa `beritaAcara` yang muncul (jika ada) hanya dari fungsi selain bootstrap.

- [ ] **Step 8: Verifikasi cakupan diff (hanya dua file kode)**

```bash
git diff --stat feat/laporan-dosen-matriks...HEAD
```

Expected: hanya `new-code1/1_business.gs` dan `new-code1/pages/dashboard.html` (plus file plan ini di `docs/`).

- [ ] **Step 9: Commit**

```bash
git add new-code1/1_business.gs new-code1/pages/dashboard.html
git commit -m "perf(dashboard): lazy-load laporan bagian and berita acara tabs instead of eager bootstrap"
```

---

## Hasil yang Ingin Dicapai (Ringkasan)

| Task | Hasil terukur |
|---|---|
| **T1** | RPC dashboard berulang (ganti filter status/jenis/blok, tab-switch, reload) dalam jendela 45 detik tidak lagi memanggil `getValues()` penuh untuk `Pengajuan`, `DetailKegiatan`, `BeritaAcara(Admin/Peserta)` — baca diambil dari `CacheService`. Kontrak output seluruh API identik; jalur tulis/validasi tetap membaca segar. |
| **T2** | Login/refresh dashboard = **1 RPC** (bukan 2). `dosenOptions` tersedia seketika dari payload bootstrap tanpa panggilan tambahan. Method mati `loadDosenOptions` dihapus. |
| **T3** | Login tidak lagi membaca sheet `BeritaAcaraAdmin` + `BeritaAcaraAdminPeserta` dan tidak menghitung `_computeBagianAggregation`. Data **Laporan Bagian** & **Berita Acara** baru dimuat saat tab pertama kali dibuka (skeleton/spinner per-section yang sudah ada tetap berfungsi). Tab `baBagian` tetap mendapat `labs` via `loadBagian()` saat pertama dibuka. |
| **Gabungan** | Waktu login (bootstrap) turun paling besar karena (a) sheet berat tidak dibaca ulang, (b) satu RPC lebih sedikit, (c) komputasi agregasi bagian + 2 baca sheet BA tidak lagi dikerjakan saat login. UX tab tetap mulus: tab yang belum pernah dibuka hanya butuh satu kali muat ringan (cache T1), lalu `loaded.*` menghindari reload. |

## Risiko & Mitigasi

- **Staleness 45 detik (T1)**: hanya untuk edit manual di luar aplikasi. Semua perubahan via aplikasi memicu `invalidateSheetCache`, sehingga baca setelah aksi admin apa pun selalu segar. Diterima & didokumentasikan.
- **Data basi di jalur tulis**: dicegah dengan aturan Global Constraints — jalur validasi/write (duplicate check, status, delete, email) sengaja TIDAK dicache.
- **Tab `baBagian` tanpa `labs`**: ditangani Step 4 Task 3 (`loadBagian()` saat tab dibuka). Karena `getBagianAggregation` sudah dicache (T1), biaya satu kali muat tab ini kecil.
- **Kontrak `getDashboardBootstrap` berubah (T2+T3)**: aman karena backend & frontend dirilis di cabang yang sama; tidak ada konsumen lain dari fungsi ini.
- **`_rowsCache` per-execution**: `invalidateSheetCache` dari eksekusi lain tidak membersihkan `_rowsCache` eksekusi ini — tidak masalah karena setiap RPC adalah eksekusi baru dengan `_rowsCache` kosong.

## Self-Review

### 1. Spec coverage
- T1 (cache sheet berat di jalur baca) → Task 1. ✅
- T2 (gabung getDosenOptions, 1 RPC) → Task 2. ✅
- T3 (lazy bagian/ba, hapus eager-load) → Task 3. ✅
- Aturan keamanan (write path tetap segar) → Global Constraints + Task 1 Step 4. ✅
- Verifikasi sintaks & scope → tiap task + Task 3 Step 8. ✅

### 2. Placeholder scan
Semua step berisi kode lengkap & perintah dengan expected output. Tidak ada "TBD"/"implement later"/"handle edge cases" tanpa kode. ✅

### 3. Type consistency
- `getAllRowsCached(sheet)` — dipakai Task 1, konsisten dengan `0_code.gs:316`.
- `b.dosen` (string[]) — ditulis Task 2 Step 1 (backend) dan dibaca Task 2 Step 2 (frontend), dipertahankan di Task 3 Step 3. Konsisten.
- `loadBagian()`/`loadBa()`/`loaded.*`/`sectionLoading.*` — sudah ada, dipakai Task 3 tanpa mengubah nama. ✅
- `getMasterOptions('Dosen')` — `1_business.gs:559`, tidak diubah. ✅
