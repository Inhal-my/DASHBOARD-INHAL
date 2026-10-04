# Pengaturan Biaya Per Pengajuan (Override) di Modal Detail Pengajuan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan kemampuan admin mengatur **biaya per pengajuan** (override biaya) melalui **dropdown nilai MasterBiaya** di dalam kotak **Keterangan Dosen** pada modal Detail Pengajuan di `dashboard.html`, dengan nilai tersimpan di sheet **CheckData** (bukan kolom baru di sheet Pengajuan).

**Architecture:** Nilai biaya override disimpan sebagai **baris CheckData** dengan key `[ID Pengajuan, Pilihan='', Detail='BIAYA-OVERRIDE', Tanggal Pelaksanaan='']` (baris khusus ber-sentinel `'BIAYA-OVERRIDE'` pada kolom Detail — tidak mungkin bentrok dengan baris check nyata yang ber-`Detail=''` untuk pengajuan tanpa detail, atau baris check ber-Detail asli). `_resolveBiayaForPengajuan` (yang dipakai di semua titik tampilan biaya: dashboard, detail-laporan, statistik, export) diperluas: cek override CheckData dulu, baru fallback MasterBiaya. Frontend menambah dropdown di Keterangan Dosen (di bawah Tanggal Pelaksanaan), `saveFields()` mengirim field `biaya` ke `updatePengajuanFields`, dan `getDashboardBootstrap` mengirim daftar nilai MasterBiaya + `getPengajuanWithDetails` mengirim nilai override saat ini (`BiayaOverride`).

**Tech Stack:** Google Apps Script (`.gs`) + HTML/Vue 3 global build (inline di `dashboard.html`).

## Global Constraints

- File yang berubah: `new-code1/0_code.gs` (skema CheckData), `new-code1/1_business.gs` (backend), `new-code1/pages/dashboard.html` (frontend).
- Skema sheet **Pengajuan TIDAK berubah** — biaya override disimpan di **CheckData**.
- Baris biaya override di CheckData memakai **sentinel `'BIAYA-OVERRIDE'` pada kolom `Detail`** (Pilihan/Tanggal kosong) → key `[ID Pengajuan, '', 'BIAYA-OVERRIDE', '']`. Ini menghindari bentrok dengan baris check nyata untuk pengajuan tanpa detail (yang ber-`Detail=''`) maupun baris check ber-Detail asli — **keputusan user (Opsi B), amandemen dari desain awal key `[id,'','','']`**.
- Biaya kosong / tidak diatur = **tidak masalah** → fallback `MasterBiaya` tetap berjalan (default).
- Field biaya berupa **dropdown nilai MasterBiaya**, diletakkan di kotak **Keterangan Dosen** di **bawah Tanggal Pelaksanaan**.
- Section Keterangan Dosen, tombol delete induk (`deletePengajuan()`), dan `saveFields()` lama **tidak dihapus** — `saveFields()` hanya menambah field `biaya` pada payload.
- Cache CheckData di-invalidate setiap kali biaya disimpan/dihapus (biaya harus langsung terlihat, TTL cache 60s di `getAllRowsCached`).
- `_upsertBiayaCheckData` mempertahankan `Hadir`/`Catatan`/`Check ID`/`Timestamp` lama bila baris CheckData untuk pengajuan itu sudah ada.
- `check.html` (root) & `getCheckPageData`/`updateCheckDataPartial` TIDAK diubah (backend lama / dead code).
- Commit message memakai konvensi repo: `feat(...)`. Trailer `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>` ditambahkan **otomatis** oleh hook `prepare-commit-msg` — JANGAN tulis manual agar tidak ganda.

---

### Task 1: Backend — tambah kolom `Biaya` di skema `CheckData`

**Files:**
- Modify: `new-code1/0_code.gs:173-189`

**Interfaces:**
- Consumes: (tidak ada)
- Produces: `SCHEMAS.CheckData` memuat `'Biaya'` → `ensureSheetWithHeaders` (0_code.gs:349) auto-migrasi menambah kolom ke sheet yang ada saat `setupDatabase()` dijalankan.

- [ ] **Step 1: Tambahkan `'Biaya'` pada `SCHEMAS.CheckData`**

Di `new-code1/0_code.gs`, blok `CheckData` (baris 173-189), tambahkan `'Biaya',` di antara `'Catatan',` dan `'UpdatedAt'`:

```javascript
        'Hadir',
        'Catatan',
        'Biaya',
        'UpdatedAt'
    ]
};
```

- [ ] **Step 2: Verifikasi**

Run: `rg -n "CheckData" new-code1/0_code.gs | head -3`
Expected: `SCHEMAS.CheckData` ada di baris 173; lalu verifikasi isinya:

Run: `sed -n '173,190p' new-code1/0_code.gs`
Expected: array berisi `'Biaya',` di antara `'Catatan',` dan `'UpdatedAt'`.

- [ ] **Step 3: Commit**

```bash
git add new-code1/0_code.gs
git commit -m "feat(backend): add Biaya column to CheckData schema"
```

---

### Task 2: Backend — helper `_upsertBiayaCheckData` + `updatePengajuanFields` dukung `biaya`

**Files:**
- Modify: `new-code1/1_business.gs` (tambah helper setelah `_resolveBiayaForPengajuan` baris 2402; modifikasi `updatePengajuanFields` baris 2678-2718)

**Interfaces:**
- Consumes: `_checkDataKey` (1_business.gs:2798), `getAllRows`, `getGlobalSpreadsheet`, `getHeadersFromSheet`, `findRowByColumnValue`, `appendRowSafe` (0_code.gs:493), `deleteRowByKey` (0_code.gs:583), `invalidateSheetCache` (0_code.gs:302), `generateId` (0_code.gs:224), `getActorName`, `writeAuditLog`.
- Produces: `_upsertBiayaCheckData(idPengajuan, biaya, pRow)` — menyimpan/hapus baris CheckData override biaya (key `[id, '', 'BIAYA-OVERRIDE', '']`); `updatePengajuanFields` menerima `payload.biaya`.

- [ ] **Step 1: Tambahkan helper `_upsertBiayaCheckData`**

Sisipkan tepat setelah fungsi `_resolveBiayaForPengajuan` (baris 2402, sebelum `// ===== BA ADMIN`):

```javascript
function _upsertBiayaCheckData(idPengajuan, biaya, pRow) {
    const id = String(idPengajuan || '').trim();
    if (!id) throw new Error('ID Pengajuan tidak tersedia.');
    const key = [id, '', 'BIAYA-OVERRIDE', ''].join('||');
    const checkRows = getAllRows('CheckData');
    let found = null;
    for (let i = 0; i < checkRows.length; i++) {
        if (_checkDataKey(checkRows[i]) === key) { found = checkRows[i]; break; }
    }

    const nilai = String(biaya || '').trim();
    if (!nilai) {
        if (found) {
            deleteRowByKey('CheckData', 'Check ID', found['Check ID'], 'Hapus baris biaya pengajuan ' + id, getActorName());
        }
        invalidateSheetCache('CheckData');
        return { success: true, cleared: !!found, message: 'Biaya kembali ke default MasterBiaya.' };
    }

    const values = {
        'ID Pengajuan': id,
        'NPM': String((pRow && pRow.NPM) || '').trim(),
        'Nama Lengkap': String((pRow && pRow['Nama Lengkap']) || '').trim(),
        'Blok': String((pRow && pRow.Blok) || '').trim(),
        'Jenis Kegiatan': String((pRow && pRow['Jenis Kegiatan']) || '').trim(),
        'Pilihan': '',
        'Detail': 'BIAYA-OVERRIDE',
        'Tanggal Pelaksanaan': '',
        'Dosen': String((pRow && pRow.Dosen) || '').trim(),
        'Biaya': nilai
    };

    if (found) {
        values['Check ID'] = found['Check ID'];
        values['Timestamp'] = found['Timestamp'];
        const sheet = getGlobalSpreadsheet().getSheetByName('CheckData');
        const headers = getHeadersFromSheet(sheet);
        const idIdx = headers.indexOf('Check ID');
        const rowIndex = findRowByColumnValue(sheet, idIdx + 1, found['Check ID']);
        if (rowIndex === -1) throw new Error('Baris CheckData tidak ditemukan.');
        const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
        headers.forEach(function(h, i) {
            if (values[h] !== undefined) row[i] = values[h];
        });
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
    } else {
        appendRowSafe('CheckData', Object.assign({ Timestamp: new Date(), 'Check ID': generateId('CHK') }, values));
    }
    invalidateSheetCache('CheckData');
    return { success: true, created: !found, message: 'Biaya pengajuan disimpan.' };
}
```

- [ ] **Step 2: Modifikasi `updatePengajuanFields` untuk menerima `biaya`**

Di `updatePengajuanFields` (1_business.gs:2678), setelah blok `if (p.jenisKegiatan !== undefined) ...` (baris 2697), sisipkan handler `biaya` dan audit log terpisah:

```javascript
        if (p.jenisKegiatan !== undefined) setField('Jenis Kegiatan', p.jenisKegiatan);

        let biayaResult = null;
        if (p.biaya !== undefined) {
            biayaResult = _upsertBiayaCheckData(idPengajuan, String(p.biaya || '').trim(), existing);
            if (biayaResult && biayaResult.success === false) {
                return { success: false, message: biayaResult.message || 'Gagal menyimpan biaya.' };
            }
        }
```

Kemudian, setelah blok audit log `if (Object.keys(values).length > 0) { ... }` (baris 2703-2713) dan **sebelum** `return { success: true, ... }`, sisipkan audit log khusus biaya:

```javascript
        if (biayaResult && biayaResult.success) {
            writeAuditLog({
                actor: getActorName(),
                action: biayaResult.cleared ? 'DELETE' : 'UPDATE',
                target: 'CheckData',
                detail: JSON.stringify({ idPengajuan: idPengajuan, biaya: String(p.biaya || '').trim(), cleared: !!biayaResult.cleared }),
                alasan: 'Pemeliharaan biaya pengajuan'
            });
        }
        return { success: true, message: 'Data pengajuan diperbarui.', values: values };
```

- [ ] **Step 3: Verifikasi**

Run: `rg -n "_upsertBiayaCheckData|biayaResult" new-code1/1_business.gs`
Expected: 3 hasil — 1 definisi `_upsertBiayaCheckData`, 1 pemanggilan di `updatePengajuanFields`, 1 blok `if (biayaResult && biayaResult.success)`.

Run: `git diff --stat new-code1/1_business.gs` — verifikasi file berubah; gunakan `git diff --check` untuk mendeteksi whitespace error.

- [ ] **Step 4: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(backend): support per-pengajuan biaya override via CheckData"
```

---

### Task 3: Backend — `_getBiayaOverrideMap` + `_resolveBiayaForPengajuan` cek override + propagasi ke semua call site

**Files:**
- Modify: `new-code1/1_business.gs` — `_getBiayaMap` area (2373), `_resolveBiayaForPengajuan` (2389), `getPengajuanWithDetails` (623), `getDashboardStats` (1362), `_computeDashboardStats` (1372), `getPengajuanList` (1448), `_buildPengajuanClientRows` (1452), `getDashboardBootstrap` (1461), `getDetailLaporanData` (1495), `getLaporanBootstrap` (1551), `getAcceptedStudentData` (3086)

**Interfaces:**
- Consumes: `getAllRowsCached` (0_code.gs:309), `parseCurrency` (1_business.gs:1899).
- Produces: `_getBiayaOverrideMap()` → `{[idPengajuan]: number}`; `_resolveBiayaForPengajuan(pengajuan, biayaMap, overrideMap)` kini menerima parameter ketiga opsional; `getDashboardBootstrap` mengembalikan `masterBiaya` (array angka unik terurut); `getPengajuanWithDetails` mengembalikan `BiayaOverride` (string atau '').

- [ ] **Step 1: Tambahkan `_getBiayaOverrideMap` tepat sebelum `_getBiayaMap`**

Sisipkan di atas `_getBiayaMap` (baris 2373):

```javascript
function _getBiayaOverrideMap() {
    try {
        const checkRows = getAllRowsCached('CheckData', 60);
        const map = {};
        checkRows.forEach(function(c) {
            const id = String(c['ID Pengajuan'] || '').trim();
            if (!id) return;
            if (String(c.Detail || '').trim() !== 'BIAYA-OVERRIDE') return;
            const pilihan = String(c.Pilihan || '').trim();
            const tanggal = String(c['Tanggal Pelaksanaan'] || '').trim();
            if (pilihan || tanggal) return;
            const biaya = String(c.Biaya || '').trim();
            if (!biaya) return;
            map[id] = parseCurrency(biaya);
        });
        return map;
    } catch (e) {
        return {};
    }
}

```

- [ ] **Step 2: Modifikasi `_resolveBiayaForPengajuan`**

Ganti signature dan tambahkan cek override di awal (sebelum `const jenis = ...`):

```javascript
function _resolveBiayaForPengajuan(pengajuan, biayaMap, overrideMap) {
    const id = String((pengajuan && pengajuan['ID Pengajuan']) || '').trim();
    overrideMap = overrideMap || _getBiayaOverrideMap();
    if (id && overrideMap[id] !== undefined && overrideMap[id] !== null && String(overrideMap[id]).trim() !== '') {
        return overrideMap[id];
    }
    biayaMap = biayaMap || _getBiayaMap();
    const jenis = String((pengajuan && pengajuan['Jenis Kegiatan']) || '').trim();
    if (jenis && biayaMap[jenis] !== undefined) return biayaMap[jenis];
```

(Isi lanjutan fungsi tetap: blok `jNorm`/loop fuzzy dan `return 0` tidak berubah.)

- [ ] **Step 3: Propagasi overrideMap di semua call site**

3a. `getPengajuanWithDetails` (baris 629-633) — ganti agar pass overrideMap dan tambah `BiayaOverride`:

```javascript
    const copy = _clientRow(pengajuan);
    copy.details = details.map(function(d) { return _clientRow(d); });
    const biayaMap = _getBiayaMap();
    const overrideMap = _getBiayaOverrideMap();
    copy.Biaya = _resolveBiayaForPengajuan(pengajuan, biayaMap, overrideMap);
    copy.BiayaOverride = (overrideMap[String(pengajuan['ID Pengajuan'] || '').trim()] !== undefined)
        ? String(overrideMap[String(pengajuan['ID Pengajuan'] || '').trim()])
        : '';
    copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
    return copy;
```

3b. `getDashboardStats` (baris 1364-1369):

```javascript
    return _computeDashboardStats(
        getAllRows('Pengajuan'),
        getAllRows('DetailKegiatan'),
        getAllRows('BeritaAcara'),
        _getBiayaMap(),
        _getBiayaOverrideMap()
    );
```

3c. `_computeDashboardStats` (baris 1372) — signature jadi `(pengajuan, details, ba, biayaMap, overrideMap)`, dan baris 1392:

```javascript
        totalBiaya += _resolveBiayaForPengajuan(p, biayaMap, overrideMap);
```

3d. `getPengajuanList` (baris 1448-1449):

```javascript
    const biayaMap = _getBiayaMap();
    return _buildPengajuanClientRows(rows, biayaMap, _getBiayaOverrideMap());
```

3e. `_buildPengajuanClientRows` (baris 1452) — signature jadi `(rows, biayaMap, overrideMap)`, dan baris 1455:

```javascript
        copy.Biaya = _resolveBiayaForPengajuan(copy, biayaMap, overrideMap);
```

3f. `getDashboardBootstrap` (baris 1466) — tambah `overrideMap` + hitung `masterBiaya`, lalu pakai di return:

```javascript
    const biayaMap = _getBiayaMap();
    const overrideMap = _getBiayaOverrideMap();
```

Setelah `const adminBa = ...` (baris 1472), sisipkan:

```javascript
    const masterBiaya = [];
    Object.keys(biayaMap).forEach(function(k) {
        const v = biayaMap[k];
        if (masterBiaya.indexOf(v) === -1) masterBiaya.push(v);
    });
    masterBiaya.sort(function(a, b) { return a - b; });
```

Ubah return (baris 1482-1492) menjadi:

```javascript
    return {
        stats: _computeDashboardStats(pengajuan, details, ba, biayaMap, overrideMap),
        pengajuan: _buildPengajuanClientRows(sortedPengajuan, biayaMap, overrideMap),
        detailMap: detailMap,
        masterBiaya: masterBiaya,
        bagian: _computeBagianAggregation(pengajuan, details, ba),
        beritaAcara: adminBa.map(function(r) {
            const c = _clientRow(r);
            c.peserta = adminBaPesertaMap[String(r['BA ID'] || '').trim()] || [];
            return c;
        })
    };
```

3g. `getDetailLaporanData` (baris 1509) — tambah `const overrideMap = _getBiayaOverrideMap();` setelah `const biayaMap = _getBiayaMap();`, dan baris 1525:

```javascript
        pengajuanCopy.Biaya = _resolveBiayaForPengajuan(pengajuanCopy, biayaMap, overrideMap);
```

3h. `getLaporanBootstrap` (baris 1557) — tambah `const overrideMap = _getBiayaOverrideMap();` setelah `const biayaMap = _getBiayaMap();`, dan baris 1598:

```javascript
        pengajuanCopy.Biaya = _resolveBiayaForPengajuan(pengajuanCopy, biayaMap, overrideMap);
```

3i. `getAcceptedStudentData` (baris 3097) — tambah `const overrideMap = _getBiayaOverrideMap();` setelah `const biayaMap = _getBiayaMap();`, dan baris 3100:

```javascript
        copy.Biaya = _resolveBiayaForPengajuan(copy, biayaMap, overrideMap);
```

- [ ] **Step 4: Verifikasi**

Run: `rg -n "_resolveBiayaForPengajuan\(" new-code1/1_business.gs`
Expected: definisi `:2389` + semua pemanggilan kini meneruskan `overrideMap` (baris 631, 1392, 1455, 1525, 1598, 3100) — tidak ada lagi pemanggilan tanpa argumen override selain definisi.

Run: `rg -n "masterBiaya|BiayaOverride|_getBiayaOverrideMap" new-code1/1_business.gs`
Expected: `_getBiayaOverrideMap` ≥ 8 hasil (1 definisi + 7 pemanggilan: 631-area, getDashboardStats, getPengajuanList, getDashboardBootstrap, getDetailLaporanData, getLaporanBootstrap, getAcceptedStudentData), `masterBiaya` (build + return), `BiayaOverride` (1).

- [ ] **Step 5: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(backend): resolve per-pengajuan biaya override before MasterBiaya fallback"
```

---

### Task 4: Frontend — dropdown biaya di Keterangan Dosen + payload `saveFields`

**Files:**
- Modify: `new-code1/pages/dashboard.html` — data state (1245-1246), markup Keterangan Dosen (990-997), `bootstrap()` (1801-1805), `applyDetailFromRow` (2015-2018), `saveFields()` (2171-2178)

**Interfaces:**
- Consumes: `getDashboardBootstrap` mengembalikan `masterBiaya` (array angka); `getPengajuanWithDetails` mengembalikan `BiayaOverride` (string atau ''); `formatRupiah` (method Vue yang sudah ada, dipakai di dashboard.html:958).
- Produces: `detail.dForm.biaya` (string, '' = default MasterBiaya); `saveFields()` mengirim `biaya` ke `updatePengajuanFields`.

- [ ] **Step 1: Tambah state `masterBiaya` dan `biaya` di `dForm`**

Di data state (baris 1245-1246):

```javascript
                    dosenOptions: [],
                    masterBiaya: [],
                    detail: { open: false, loading: false, showLengkap: false, p: null, baList: [], dForm: { dosen: '', tanggalPelaksanaan: '', biaya: '' }, status: 'Diterima', catatan: '', editInduk: false, iForm: { email: '', noHp: '', blok: '', jenisKegiatan: '', tanggalPelaksanaan: '' }, editDetailIndex: -1, dEdit: { jenisKegiatan: '', pilihan: '', detail: '', tanggalPelaksanaan: '' } },
```

- [ ] **Step 2: Isi `masterBiaya` di `bootstrap()`**

Di `bootstrap()` (baris 1801-1804), setelah `this.detailMap = b.detailMap || {};`:

```javascript
                        this.detailMap = b.detailMap || {};
                        this.masterBiaya = b.masterBiaya || [];
```

- [ ] **Step 3: Tambah dropdown Biaya di kotak Keterangan Dosen**

Di markup Keterangan Dosen, tepat setelah div Tanggal Pelaksanaan (baris 992):

```html
                                    <div><label class="label">Tanggal Pelaksanaan</label><input v-model="detail.dForm.tanggalPelaksanaan" type="datetime-local" class="input"></div>
                                    <div><label class="label">Biaya</label><select v-model="detail.dForm.biaya" class="input"><option value="">Default (Master Biaya)</option><option v-for="b in masterBiaya" :key="b" :value="String(b)">{{ formatRupiah(b) }}</option></select></div>
```

- [ ] **Step 4: Isi `dForm.biaya` di `applyDetailFromRow`**

Di `applyDetailFromRow` (baris 2015-2018):

```javascript
                    this.detail.dForm = {
                        dosen: p.Dosen || '',
                        tanggalPelaksanaan: this.toDatetimeLocalInputValue(p['Tanggal Pelaksanaan']),
                        biaya: p.BiayaOverride ? String(p.BiayaOverride) : ''
                    };
```

- [ ] **Step 5: Kirim `biaya` di `saveFields()`**

Di `saveFields()` (baris 2175-2178):

```javascript
                        const res = await this.run('updatePengajuanFields', this.detail.p['ID Pengajuan'], {
                            dosen: (d.dosen || '').trim(),
                            tanggalPelaksanaan: d.tanggalPelaksanaan || '',
                            biaya: (d.biaya || '').trim()
                        });
```

- [ ] **Step 6: Verifikasi**

Run: `rg -n "masterBiaya|dForm.biaya|biaya:" new-code1/pages/dashboard.html`
Expected: `masterBiaya` 3 hasil (state, `bootstrap`, markup `v-for`), `dForm.biaya` 2 hasil (state, `applyDetailFromRow`), `biaya:` di `saveFields` 1 hasil.

Run (balance div, bagian Keterangan Dosen 990-998):

```bash
node -e "
const s=require('fs').readFileSync('new-code1/pages/dashboard.html','utf8');
const seg=s.slice(0,s.indexOf('detail.showLengkap')>0?0:0);
function bal(html){const d=(html.match(/<div/g)||[]).length;const cd=(html.match(/<\/div>/g)||[]).length;return d-cd;}
console.log('diff open-div vs close-div (Keterangan section):', bal(s.slice(s.indexOf('<div class=\"mt-5 rounded-2xl bg-slate-50/70 p-4\">'), s.indexOf('<!-- detail kegiatan'))));
"
```
Expected: `0` (div seimbang pada section Keterangan Dosen setelah penambahan dropdown).

- [ ] **Step 7: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): add per-pengajuan biaya override dropdown in Keterangan Dosen"
```

---

### Task 5: Verifikasi akhir statis + review

**Files:**
- (tidak ada perubahan)

- [ ] **Step 1: Pastikan hanya 3 file berubah pada branch**

Run: `git diff --stat main...HEAD -- new-code1`
Expected: hanya `new-code1/0_code.gs`, `new-code1/1_business.gs`, `new-code1/pages/dashboard.html` yang berubah (plus file plan). `new-code1/2_web.gs`, `new-code1/appsscript.json`, `new-code1/docs/`, `new-code1/pages/bagian.html|index.html|portal.html`, `template-*` **tidak** masuk (untracked dari awal).

- [ ] **Step 2: Verifikasi seluruh identifier backend & frontend hadir**

```bash
rg -c "_getBiayaOverrideMap|_upsertBiayaCheckData|BiayaOverride|masterBiaya" new-code1/1_business.gs new-code1/pages/dashboard.html
```
Expected: semua > 0.

```bash
rg -n "Biaya" new-code1/0_code.gs | head -3
```
Expected: `SCHEMAS.CheckData` memuat `'Biaya'`.

- [ ] **Step 3: Verifikasi tidak ada pemanggilan `_resolveBiayaForPengajuan` yang lupa overrideMap**

```bash
rg -n "_resolveBiayaForPengajuan\([^)]*\)" new-code1/1_business.gs
```
Expected: setiap pemanggilan memiliki 2 atau 3 argumen (tidak ada yang hanya `(pengajuan)` selain definisi), dan semua meneruskan `overrideMap`.

- [ ] **Step 4: Tag balance seluruh file**

```bash
node -e "
for (const f of ['new-code1/0_code.gs','new-code1/1_business.gs','new-code1/pages/dashboard.html']) {
  const s=require('fs').readFileSync(f,'utf8');
  const open=(s.match(/[({[]/g)||[]).length, close=(s.match(/[)}\]]/g)||[]).length;
  console.log(f, 'open:', open, 'close:', close, open===close?'OK':'MISMATCH');
}
"
```
Expected: ketiga baris `OK`.

- [ ] **Step 5: Whole-branch review**

Dispatch code review atas seluruh diff branch (`git diff main...HEAD`), fokus: konsistensi skema CheckData (Task 1), helper upsert mempertahankan field lama & invalidate cache (Task 2), tidak ada call site yang kehilangan overrideMap (Task 3), dropdown bekerja dengan nilai string dari `masterBiaya` (Task 4). Perbaiki temuan lalu commit fix terpisah bila ada.

---
