# Edit & Hapus Data Pengajuan + Detail Kegiatan di Modal Detail Pengajuan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan kemampuan **edit** dan **hapus** untuk (a) data induk pengajuan dan (b) baris detail kegiatan, di dalam modal **Detail Pengajuan** pada tab **Pengajuan** di `dashboard.html`.

**Architecture:** Frontend memanggil fungsi backend GAS via `google.script.run` (helper `run()` di dashboard.html:1478). Identifikasi baris `DetailKegiatan` memakai **index** (posisi baris ke-N yang cocok dengan `ID Pengajuan`, urut = urutan sheet, baris kosong disaring — konsisten dengan `getAllRows`). Backend memakai `LockService` + `requireAuthorized` + audit log (pola sama seperti fungsi admin yang sudah ada).

**Tech Stack:** Google Apps Script (`.gs`) + HTML/Vue 3 global build (inline di `dashboard.html`).

## Global Constraints

- File yang berubah: `new-code1/1_business.gs` (backend) dan `new-code1/pages/dashboard.html` (frontend).
- NPM & Nama Lengkap **read-only** (tidak bisa diedit).
- Field data induk yang bisa diedit: **Email, No. HP/WA, Blok, Jenis Kegiatan, Tanggal Pelaksanaan**.
- Field per-baris detail kegiatan yang bisa diedit: **Jenis Kegiatan, Pilihan, Detail, Tanggal Pelaksanaan** (jenis kegiatan ikut bisa diedit — keputusan user). Untuk Praktikum, kolom `Bagian` dihitung ulang via `_resolveBagianFor`.
- Tombol **Hapus data induk** yang sudah ada di section "Keterangan Dosen" (`deletePengajuan()`) **TIDAK diubah** — tetap di sana.
- Section "Keterangan Dosen" + `saveFields()` **TIDAK diubah** (tetap ada, terpisah).
- Tidak ada tombol "Tambah baris detail" (cukup edit/hapus yang sudah ada).
- Identifikasi baris detail = **Opsi C (index)**.
- Setelah simpan/hapus detail atau edit induk: `reloadDetail(id)` lalu **modal tetap terbuka** (tidak ditutup otomatis, agar admin bisa lihat hasil). Ini berbeda dari `saveFields()` lama yang menutup modal — perilaku baru hanya untuk fitur baru.
- Commit message memakai konvensi repo: `feat(...)` / `docs(...)`, dengan trailer `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.

---

### Task 1: Backend — helper pencarian baris detail by index

**Files:**
- Modify: `new-code1/1_business.gs`

**Interfaces:**
- Consumes: `getGlobalSpreadsheet()`, `getHeadersFromSheet()`.
- Produces: `_findDetailKegiatanRowByIdIndex(idPengajuan, index)` — dipakai Task 2 & 3.

- [ ] **Step 1: Tambahkan helper**

Tambahkan dekat fungsi admin maintenance (sebelum `updatePengajuanFields` di baris 2584):

```javascript
function _findDetailKegiatanRowByIdIndex(idPengajuan, index) {
    const sheet = getGlobalSpreadsheet().getSheetByName('DetailKegiatan');
    if (!sheet) throw new Error('Sheet DetailKegiatan tidak ditemukan.');
    const headers = getHeadersFromSheet(sheet);
    const idIdx = headers.indexOf('ID Pengajuan');
    if (idIdx === -1) throw new Error('Kolom ID Pengajuan tidak ditemukan di DetailKegiatan.');
    const last = sheet.getLastRow();
    if (last < 2) return -1;
    const values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
    let n = -1;
    for (let i = 0; i < values.length; i++) {
        const hasValue = values[i].some(function(c) {
            return c !== null && c !== undefined && String(c).trim() !== '';
        });
        if (!hasValue) continue;
        if (String(values[i][idIdx]).trim() === String(idPengajuan || '').trim()) {
            n++;
            if (n === index) return i + 2;
        }
    }
    return -1;
}
```

- [ ] **Step 2: Verifikasi**

Run: `rg -n "_findDetailKegiatanRowByIdIndex" new-code1/1_business.gs`
Expected: 1 hasil (definisi fungsi).

- [ ] **Step 3: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(dashboard): add helper to find DetailKegiatan row by index Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 2: Backend — `updatePengajuanFields` dukung `jenisKegiatan`

**Files:**
- Modify: `new-code1/1_business.gs` — fungsi `updatePengajuanFields` (baris 2584).

**Interfaces:**
- Consumes: `getRowByKey`, `_setPengajuanColumns`, `writeAuditLog`.
- Produces: dukungan field `jenisKegiatan` (kolom `Jenis Kegiatan`).

- [ ] **Step 1: Tambahkan field `jenisKegiatan`**

Di dalam `updatePengajuanFields`, setelah baris `if (p.keterangan !== undefined) setField('Keterangan', p.keterangan);`, tambahkan:

```javascript
        if (p.jenisKegiatan !== undefined) setField('Jenis Kegiatan', p.jenisKegiatan);
```

- [ ] **Step 2: Verifikasi**

Run: `rg -n "jenisKegiatan" new-code1/1_business.gs`
Expected: 1 hasil di dalam `updatePengajuanFields`.

- [ ] **Step 3: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(dashboard): support editing jenis kegiatan in updatePengajuanFields Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 3: Backend — `updateDetailKegiatan` (edit baris detail by index)

**Files:**
- Modify: `new-code1/1_business.gs` — tambah fungsi setelah `_findDetailKegiatanRowByIdIndex`.

**Interfaces:**
- Consumes: `requireAuthorized`, `LockService`, `_findDetailKegiatanRowByIdIndex`, `_resolveBagianFor`, `getGlobalSpreadsheet`, `getHeadersFromSheet`, `writeAuditLog`.
- Produces: fungsi `updateDetailKegiatan(idPengajuan, index, payload)` — dipakai Task 5.

- [ ] **Step 1: Tambahkan fungsi**

```javascript
function updateDetailKegiatan(idPengajuan, index, payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const rowIndex = _findDetailKegiatanRowByIdIndex(idPengajuan, index);
        if (rowIndex === -1) return { success: false, message: 'Detail kegiatan tidak ditemukan.' };
        const sheet = getGlobalSpreadsheet().getSheetByName('DetailKegiatan');
        const headers = getHeadersFromSheet(sheet);
        const p = payload || {};
        const values = {};
        const setField = function(header, raw) {
            values[header] = String(raw === undefined || raw === null ? '' : raw).trim();
        };
        if (p.jenisKegiatan !== undefined) setField('Jenis Kegiatan', p.jenisKegiatan);
        if (p.pilihan !== undefined) setField('Pilihan', p.pilihan);
        if (p.detail !== undefined) setField('Detail', p.detail);
        if (p.tanggalPelaksanaan !== undefined) setField('Tanggal Pelaksanaan', p.tanggalPelaksanaan);
        if (values['Jenis Kegiatan'] === 'Praktikum') {
            values['Bagian'] = _resolveBagianFor('Praktikum', values['Pilihan'], values['Detail']);
        }
        if (Object.keys(values).length > 0) {
            const existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
            const row = existing.slice();
            headers.forEach(function(h, i) {
                if (values[h] !== undefined) row[i] = values[h];
            });
            sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
            writeAuditLog({
                actor: getActorName(),
                action: 'UPDATE',
                target: 'DetailKegiatan',
                detail: JSON.stringify(Object.assign({ idPengajuan: idPengajuan, index: index }, values)),
                alasan: 'Pemeliharaan data admin'
            });
        }
        return { success: true, message: 'Detail kegiatan diperbarui.' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    } finally {
        lock.releaseLock();
    }
}
```

- [ ] **Step 2: Verifikasi**

Run: `rg -n "function updateDetailKegiatan" new-code1/1_business.gs`
Expected: 1 hasil.

- [ ] **Step 3: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(dashboard): add updateDetailKegiatan to edit a detail row by index Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 4: Backend — `deleteDetailKegiatan` (hapus baris detail by index)

**Files:**
- Modify: `new-code1/1_business.gs` — tambah fungsi setelah `updateDetailKegiatan`.

**Interfaces:**
- Consumes: `requireAuthorized`, `LockService`, `_findDetailKegiatanRowByIdIndex`, `getGlobalSpreadsheet`, `getHeadersFromSheet`, `writeAuditLog`.
- Produces: fungsi `deleteDetailKegiatan(idPengajuan, index)` — dipakai Task 5.

- [ ] **Step 1: Tambahkan fungsi**

```javascript
function deleteDetailKegiatan(idPengajuan, index) {
    requireAuthorized(arguments[arguments.length - 1]);
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const rowIndex = _findDetailKegiatanRowByIdIndex(idPengajuan, index);
        if (rowIndex === -1) return { success: false, message: 'Detail kegiatan tidak ditemukan.' };
        const sheet = getGlobalSpreadsheet().getSheetByName('DetailKegiatan');
        const headers = getHeadersFromSheet(sheet);
        const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
        const data = rowToObject(headers, row);
        sheet.deleteRow(rowIndex);
        writeAuditLog({
            actor: getActorName(),
            action: 'DELETE',
            target: 'DetailKegiatan',
            detail: JSON.stringify(data),
            alasan: 'Pemeliharaan data admin'
        });
        return { success: true, message: 'Detail kegiatan dihapus.' };
    } catch (e) {
        return { success: false, message: (e && e.message) ? e.message : String(e) };
    } finally {
        lock.releaseLock();
    }
}
```

- [ ] **Step 2: Verifikasi**

Run: `rg -n "function deleteDetailKegiatan" new-code1/1_business.gs`
Expected: 1 hasil.

- [ ] **Step 3: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(dashboard): add deleteDetailKegiatan to remove a detail row by index Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 5: Frontend — kotak profil + tombol Edit data induk

**Files:**
- Modify: `new-code1/pages/dashboard.html`
  - Template: kotak profil di modal Detail Pengajuan (baris 943-953).
  - State `data()`: objek `detail` (baris 1201) — tambah `editInduk`, `iForm`.
  - Methods: `applyDetailFromRow` (baris 1965) — inisialisasi `iForm` & reset `editInduk`.
  - Methods baru: `startEditInduk()`, `cancelEditInduk()`, `saveIndukFields()`.

**Interfaces:**
- Consumes: `updatePengajuanFields` (Task 2), `reloadDetail`, `notify`, `toDatetimeLocalInputValue`, `formatTanggal`.
- Produces: UI edit data induk di kotak profil.

- [ ] **Step 1: State**

Di objek `detail` (baris 1201), tambahkan:

```javascript
                    detail: { open: false, loading: false, showLengkap: false, p: null, baList: [], dForm: { dosen: '', tanggalPelaksanaan: '' }, status: 'Diterima', catatan: '', editInduk: false, iForm: { email: '', noHp: '', blok: '', jenisKegiatan: '', tanggalPelaksanaan: '' } },
```

- [ ] **Step 2: Inisialisasi di `applyDetailFromRow`**

Di dalam `applyDetailFromRow` (baris 1970), setelah blok `this.detail.dForm = {...};`, tambahkan:

```javascript
                    this.detail.iForm = {
                        email: p.Email || '',
                        noHp: p['No. HP/WA'] || '',
                        blok: p.Blok || '',
                        jenisKegiatan: p['Jenis Kegiatan'] || '',
                        tanggalPelaksanaan: this.toDatetimeLocalInputValue(p['Tanggal Pelaksanaan'])
                    };
                    this.detail.editInduk = false;
```

- [ ] **Step 3: Template kotak profil**

Ganti blok `<div class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">...</div>` (baris 944-953) dengan struktur ber-container + tombol Edit. View mode menampilkan Email & No. HP/WA (baru). Edit mode menampilkan input untuk Email, No. HP/WA, Blok, Jenis Kegiatan, Tanggal Pelaksanaan; NPM & Nama tetap readonly. Tombol Simpan → `saveIndukFields()`, Batal → `cancelEditInduk()`.

```html
                            <div class="rounded-2xl bg-slate-50/70 p-4">
                                <div class="mb-3 flex items-center justify-between">
                                    <span class="flex items-center gap-2 text-sm font-bold text-slate-900"><i class="bi bi-person-badge text-base text-brand-600"></i> Data Mahasiswa</span>
                                    <button v-if="!detail.editInduk" class="btn-soft !px-3 !py-1.5 text-xs" @click="startEditInduk()"><i class="bi bi-pencil-square"></i>Edit</button>
                                </div>
                                <div v-if="!detail.editInduk" class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div><div class="label">NPM</div><div class="value">{{ detail.p.NPM }}</div></div>
                                    <div><div class="label">Nama Lengkap</div><div class="value font-semibold">{{ detail.p['Nama Lengkap'] }}</div></div>
                                    <div><div class="label">Email</div><div class="value">{{ detail.p.Email || '—' }}</div></div>
                                    <div><div class="label">No. HP/WA</div><div class="value">{{ detail.p['No. HP/WA'] || '—' }}</div></div>
                                    <div><div class="label">Blok</div><div class="value">{{ detail.p.Blok }}</div></div>
                                    <div><div class="label">Jenis Kegiatan</div><div class="value">{{ detail.p['Jenis Kegiatan'] }}</div></div>
                                    <div><div class="label">Tanggal Pelaksanaan</div><div class="value">{{ detail.p['Tanggal Pelaksanaan'] ? formatTanggalWaktu(detail.p['Tanggal Pelaksanaan']) : '—' }}</div></div>
                                    <div><div class="label">Tanggal Daftar</div><div class="value">{{ formatTanggal(detail.p.Timestamp) }}</div></div>
                                    <div><div class="label">Biaya</div><div class="value font-semibold text-brand-700">{{ detail.p['Biaya Rupiah'] || formatRupiah(detail.p.Biaya) }}</div></div>
                                    <div><div class="label">Nomor Surat</div><div class="value">{{ detail.p['Nomor Surat'] || '—' }}</div></div>
                                    <div><div class="label">Keterangan</div><div class="value">{{ detail.p.Keterangan || '—' }}</div></div>
                                </div>
                                <div v-else class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div><div class="label">NPM</div><div class="value font-semibold">{{ detail.p.NPM }}</div></div>
                                    <div><div class="label">Nama Lengkap</div><div class="value font-semibold">{{ detail.p['Nama Lengkap'] }}</div></div>
                                    <div><label class="label">Email</label><input v-model="detail.iForm.email" type="email" class="input"></div>
                                    <div><label class="label">No. HP/WA</label><input v-model="detail.iForm.noHp" class="input"></div>
                                    <div><label class="label">Blok</label><input v-model="detail.iForm.blok" class="input"></div>
                                    <div><label class="label">Jenis Kegiatan</label><input v-model="detail.iForm.jenisKegiatan" class="input"></div>
                                    <div><label class="label">Tanggal Pelaksanaan</label><input v-model="detail.iForm.tanggalPelaksanaan" type="datetime-local" class="input"></div>
                                    <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                                        <button class="btn-primary" @click="saveIndukFields()"><i class="bi bi-save"></i>Simpan</button>
                                        <button class="btn-soft" @click="cancelEditInduk()">Batal</button>
                                    </div>
                                </div>
                            </div>
```

- [ ] **Step 4: Methods baru**

Tambahkan setelah `applyDetailFromRow` (sebelum `openDetail`):

```javascript
                startEditInduk() {
                    const p = this.detail.p;
                    if (!p) return;
                    this.detail.iForm = {
                        email: p.Email || '',
                        noHp: p['No. HP/WA'] || '',
                        blok: p.Blok || '',
                        jenisKegiatan: p['Jenis Kegiatan'] || '',
                        tanggalPelaksanaan: this.toDatetimeLocalInputValue(p['Tanggal Pelaksanaan'])
                    };
                    this.detail.editInduk = true;
                },
                cancelEditInduk() {
                    this.detail.editInduk = false;
                },
                async saveIndukFields() {
                    const f = this.detail.iForm;
                    this.loading = true;
                    try {
                        const res = await this.run('updatePengajuanFields', this.detail.p['ID Pengajuan'], {
                            email: (f.email || '').trim(),
                            noHp: (f.noHp || '').trim(),
                            blok: (f.blok || '').trim(),
                            jenisKegiatan: (f.jenisKegiatan || '').trim(),
                            tanggalPelaksanaan: f.tanggalPelaksanaan || ''
                        });
                        if (res && res.success === false) { this.notify((res && res.message) || 'Gagal menyimpan.', false); return; }
                        this.notify((res && res.message) || 'Data pengajuan diperbarui.');
                        this.detail.editInduk = false;
                        await this.reloadDetail(this.detail.p['ID Pengajuan']);
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.loading = false;
                    }
                },
```

- [ ] **Step 5: Verifikasi statis**

```bash
rg -n "editInduk|iForm|saveIndukFields|startEditInduk|cancelEditInduk" new-code1/pages/dashboard.html
node -e "const h=require('fs').readFileSync('new-code1/pages/dashboard.html','utf8'); const c=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<!--[^]*?-->/g,''); const o=[...c.matchAll(/<div([^>]*)>/g)].filter(m=>!m[1].trim().endsWith('/')).length; const cl=[...c.matchAll(/<\/div>/g)].length; const ot=[...c.matchAll(/<transition([^>]*)>/g)].filter(m=>!m[1].trim().endsWith('/')).length; const ct=[...c.matchAll(/<\/transition>/g)].length; console.log('div',o,'/',cl,'| transition',ot,'/',ct);"
```

Expected: semua nama muncul; `div open == close`; `transition open == close`.

- [ ] **Step 6: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): add edit for pengajuan main fields in detail modal Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 6: Frontend — edit & hapus per baris detail kegiatan

**Files:**
- Modify: `new-code1/pages/dashboard.html`
  - Template: kartu detail kegiatan (baris 983-990) — tambah tombol edit/hapus + mode edit inline.
  - Methods baru: `startEditDetail(i)`, `cancelEditDetail()`, `saveDetailRow()`, `deleteDetailRow(i)`.

**Interfaces:**
- Consumes: `updateDetailKegiatan` & `deleteDetailKegiatan` (Task 3 & 4), `reloadDetail`, `notify`, `toDatetimeLocalInputValue`, `formatTanggal`.
- Produces: UI edit/hapus per baris detail kegiatan.

- [ ] **Step 1: State**

Di objek `detail` (baris 1201), tambahkan `editDetailIndex: -1` dan `dEdit`:

```javascript
                    detail: { open: false, loading: false, showLengkap: false, p: null, baList: [], dForm: { dosen: '', tanggalPelaksanaan: '' }, status: 'Diterima', catatan: '', editInduk: false, iForm: { email: '', noHp: '', blok: '', jenisKegiatan: '', tanggalPelaksanaan: '' }, editDetailIndex: -1, dEdit: { jenisKegiatan: '', pilihan: '', detail: '', tanggalPelaksanaan: '' } },
```

- [ ] **Step 2: Reset di `applyDetailFromRow`**

Setelah `this.detail.editInduk = false;`, tambahkan:

```javascript
                    this.detail.editDetailIndex = -1;
                    this.detail.dEdit = { jenisKegiatan: '', pilihan: '', detail: '', tanggalPelaksanaan: '' };
```

- [ ] **Step 3: Template kartu detail**

Ganti blok `<div class="grid gap-2">...</div>` (baris 982-991) dengan versi ber-index + tombol. View mode sama seperti sekarang (ditambah kolom Jenis Kegiatan pada info). Edit mode menampilkan input Jenis Kegiatan, Pilihan, Detail, Tanggal Pelaksanaan + Simpan/Batal.

```html
                                    <div class="grid gap-2">
                                        <div v-for="(d, i) in detail.p.details" :key="i" class="rounded-xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                                            <div v-if="detail.editDetailIndex !== i">
                                                <div class="flex items-start justify-between gap-2">
                                                    <div class="min-w-0">
                                                        <div class="text-sm font-bold text-slate-800">{{ d.Pilihan }}</div>
                                                        <div class="mt-1 text-xs text-slate-500">{{ d.Detail }}</div>
                                                    </div>
                                                    <div class="flex shrink-0 items-center gap-1">
                                                        <button class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600" @click="startEditDetail(i)" title="Edit"><i class="bi bi-pencil-square text-sm"></i></button>
                                                        <button class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500" @click="deleteDetailRow(i)" title="Hapus"><i class="bi bi-trash text-sm"></i></button>
                                                    </div>
                                                </div>
                                                <div class="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-400">
                                                    <span><i class="bi bi-tag"></i> {{ d['Jenis Kegiatan'] }}</span>
                                                    <span><i class="bi bi-calendar3"></i> {{ formatTanggal(d['Tanggal Pelaksanaan']) }}</span>
                                                    <span><i class="bi bi-diagram-3"></i> {{ d.Bagian }}</span>
                                                </div>
                                            </div>
                                            <div v-else>
                                                <div class="grid gap-2">
                                                    <div><label class="label">Jenis Kegiatan</label><input v-model="detail.dEdit.jenisKegiatan" class="input !py-2 text-xs"></div>
                                                    <div><label class="label">Pilihan</label><input v-model="detail.dEdit.pilihan" class="input !py-2 text-xs"></div>
                                                    <div><label class="label">Detail</label><input v-model="detail.dEdit.detail" class="input !py-2 text-xs"></div>
                                                    <div><label class="label">Tanggal Pelaksanaan</label><input v-model="detail.dEdit.tanggalPelaksanaan" type="datetime-local" class="input !py-2 text-xs"></div>
                                                </div>
                                                <div class="mt-2 flex gap-2">
                                                    <button class="btn-primary !px-3 !py-1.5 text-xs" @click="saveDetailRow()"><i class="bi bi-save"></i>Simpan</button>
                                                    <button class="btn-soft !px-3 !py-1.5 text-xs" @click="cancelEditDetail()">Batal</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
```

- [ ] **Step 4: Methods baru**

Tambahkan setelah `saveIndukFields`:

```javascript
                startEditDetail(i) {
                    const d = (this.detail.p && this.detail.p.details) ? this.detail.p.details[i] : null;
                    if (!d) return;
                    this.detail.dEdit = {
                        jenisKegiatan: d['Jenis Kegiatan'] || '',
                        pilihan: d.Pilihan || '',
                        detail: d.Detail || '',
                        tanggalPelaksanaan: this.toDatetimeLocalInputValue(d['Tanggal Pelaksanaan'])
                    };
                    this.detail.editDetailIndex = i;
                },
                cancelEditDetail() {
                    this.detail.editDetailIndex = -1;
                    this.detail.dEdit = { jenisKegiatan: '', pilihan: '', detail: '', tanggalPelaksanaan: '' };
                },
                async saveDetailRow() {
                    const f = this.detail.dEdit;
                    const idx = this.detail.editDetailIndex;
                    if (idx === -1) return;
                    this.loading = true;
                    try {
                        const res = await this.run('updateDetailKegiatan', this.detail.p['ID Pengajuan'], idx, {
                            jenisKegiatan: (f.jenisKegiatan || '').trim(),
                            pilihan: (f.pilihan || '').trim(),
                            detail: (f.detail || '').trim(),
                            tanggalPelaksanaan: f.tanggalPelaksanaan || ''
                        });
                        if (res && res.success === false) { this.notify((res && res.message) || 'Gagal menyimpan.', false); return; }
                        this.notify((res && res.message) || 'Detail kegiatan diperbarui.');
                        this.cancelEditDetail();
                        await this.reloadDetail(this.detail.p['ID Pengajuan']);
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.loading = false;
                    }
                },
                async deleteDetailRow(i) {
                    if (!confirm('Hapus detail kegiatan ini dari pengajuan ' + this.detail.p['ID Pengajuan'] + '?')) return;
                    this.loading = true;
                    try {
                        const res = await this.run('deleteDetailKegiatan', this.detail.p['ID Pengajuan'], i);
                        this.notify((res && res.message) || 'Detail kegiatan dihapus.');
                        if (res && res.success) {
                            this.cancelEditDetail();
                            await this.reloadDetail(this.detail.p['ID Pengajuan']);
                        }
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.loading = false;
                    }
                },
```

- [ ] **Step 5: Verifikasi statis**

```bash
rg -n "editDetailIndex|dEdit|saveDetailRow|deleteDetailRow|startEditDetail|cancelEditDetail" new-code1/pages/dashboard.html
node -e "const h=require('fs').readFileSync('new-code1/pages/dashboard.html','utf8'); const c=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<!--[^]*?-->/g,''); const o=[...c.matchAll(/<div([^>]*)>/g)].filter(m=>!m[1].trim().endsWith('/')).length; const cl=[...c.matchAll(/<\/div>/g)].length; const ot=[...c.matchAll(/<transition([^>]*)>/g)].filter(m=>!m[1].trim().endsWith('/')).length; const ct=[...c.matchAll(/<\/transition>/g)].length; console.log('div',o,'/',cl,'| transition',ot,'/',ct);"
```

Expected: semua nama muncul; `div open == close`; `transition open == close`.

- [ ] **Step 6: Verifikasi JS methods balance**

```bash
node -e "const h=require('fs').readFileSync('new-code1/pages/dashboard.html','utf8'); const s=h.match(/createApp\(\{[\s\S]*?\}\);/)[0]; const open=(s.match(/\{/g)||[]).length, close=(s.match(/\}/g)||[]).length; console.log('brace',open,'/',close);"
```

Expected: `open == close` untuk blok `createApp({...});`.

- [ ] **Step 7: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): add edit and delete per detail kegiatan row in detail modal Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 7: Verifikasi akhir

- [ ] **Step 1: Verifikasi statis menyeluruh**

```bash
rg -n "updateDetailKegiatan|deleteDetailKegiatan|_findDetailKegiatanRowByIdIndex|jenisKegiatan" new-code1/1_business.gs
rg -n "saveIndukFields|saveDetailRow|deleteDetailRow|startEditDetail|startEditInduk|editInduk|editDetailIndex" new-code1/pages/dashboard.html
```

Expected: semua fungsi backend & frontend ada.

- [ ] **Step 2: Uji di browser (deployment GAS asli)**

Login sebagai admin pada deployment GAS asli. Di tab **Pengajuan**, buka modal **Detail Pengajuan** lalu uji:
- **Edit data induk**: tombol Edit di kotak profil → ubah Email, No. HP/WA, Blok, Jenis Kegiatan, Tanggal Pelaksanaan → Simpan → data berubah, modal tetap terbuka. NPM & Nama tidak bisa diedit.
- **Edit detail kegiatan**: klik pensil pada kartu detail → ubah Jenis Kegiatan/Pilihan/Detail/Tanggal → Simpan → kartu diperbarui.
- **Hapus detail kegiatan**: klik trash → konfirmasi → kartu hilang, `reloadDetail` sukses.
- **Keterangan Dosen**: tetap berfungsi seperti sebelumnya (`saveFields`, `deletePengajuan`).
- Scroll-lock & responsivitas modal tetap normal.

- [ ] **Step 3: Commit final (jika ada perbaikan dari uji browser)**

Hanya jika Step 2 menemukan masalah; commit perbaikan dengan pesan deskriptif, lalu ulangi Step 2.

---
