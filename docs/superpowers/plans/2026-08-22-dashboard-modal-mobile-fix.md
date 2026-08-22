# Perbaikan Modal Mobile di `dashboard.html` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki modal di `dashboard.html` agar seluruh kontennya (termasuk bagian bawah) dapat dijangkau di semua ukuran layar, dengan scroll-lock body saat modal terbuka.

**Architecture:** Ganti pola centering `flex items-center justify-center` (yang memotong konten lebih tinggi dari viewport) dengan pola **overlay scrollable + panel `margin:auto`** via 3 kelas CSS custom (`modal-overlay`, `modal-panel`, `modal-body`), terapkan ke 4 modal, lalu kunci scroll body via Vue `watch` + `computed`. Unit `dvh` dipakai agar tinggi modal mengikuti viewport dinamis HP.

**Tech Stack:** HTML + CSS (custom di blok `<style>`) + Vue 3 (global build, `createApp` inline).

## Global Constraints

- Hanya `new-code1/pages/dashboard.html` yang boleh berubah. (dari spec)
- Modal yang diperbaiki: Detail Pengajuan (baris ~892), Master Data (~1027), Upload BA (~1069), Konfirmasi BA (~649). (dari spec)
- Overlay loading (`v-if="loading"`, baris ~74) dan overlay sidebar (`v-if="sidebarOpen"`, baris ~124) **tidak diubah**. (dari spec)
- Tidak mengubah logika data, payload, atau endpoint. (dari spec)
- Kelas lama yang dihapus dari 4 modal: `flex items-center justify-center p-4` pada overlay; `relative w-full flex flex-col overflow-hidden rounded-2xl bg-white` (atau `relative w-full ... overflow-hidden rounded-2xl bg-white`) pada panel; `flex-1 overflow-y-auto` pada body. (dari spec)
- CSS baru memakai `dvh` dengan fallback `vh` (deklarasi `100vh` ditulis sebelum `100dvh`). (dari spec)
- Karena blok compiled Tailwind muncul setelah blok `<style>` custom, kelas custom TIDAK boleh bentrok nilai dengan kelas Tailwind yang tersisa di elemen yang sama. (dari spec)
- Commit message memakai konvensi repo: `feat(...)` / `docs(...)`, dengan trailer `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.

---

### Task 1: CSS custom untuk modal (3 kelas)

**Files:**
- Modify: `new-code1/pages/dashboard.html` — blok `<style>` custom, sisipkan setelah baris 54 (`.master-table thead th ...`) dan sebelum baris 56 (`<style>` Tailwind diikuti `@media`).

**Interfaces:**
- Consumes: tidak ada.
- Produces: kelas CSS `.modal-overlay`, `.modal-panel`, `.modal-body` — dipakai oleh Task 2-5.

- [ ] **Step 1: Tambahkan 3 kelas CSS**

Di blok `<style>` custom (setelah `.master-table thead th { position: sticky; top: 0; z-index: 1; background: #f8fafc; }`), tambahkan:

```css
.modal-overlay {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.modal-panel {
    position: relative;
    width: 100%;
    max-height: calc(100vh - 2rem);
    max-height: calc(100dvh - 2rem);
    margin: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1rem;
    background: #fff;
}
.modal-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
}
```

- [ ] **Step 2: Verifikasi**

Run: `rg -n "\.modal-overlay|\.modal-panel|\.modal-body" new-code1/pages/dashboard.html`
Expected: 3 hasil, semuanya di dalam blok `<style>` custom (sebelum baris compiled Tailwind di baris 66).

- [ ] **Step 3: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): add modal-overlay/panel/body css classes for mobile-friendly modals Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

### Task 2: Terapkan pola ke modal Detail Pengajuan

**Files:**
- Modify: `new-code1/pages/dashboard.html:892-895` (overlay + panel), `:917` (body), `:896` (header).

**Interfaces:**
- Consumes: kelas `.modal-overlay`, `.modal-panel`, `.modal-body` dari Task 1.
- Produces: pola kelas yang sama diterapkan di Task 3-5 sebagai referensi.

- [ ] **Step 1: Ganti overlay + panel**

Ubah:

```html
<div v-if="detail.open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
```

menjadi:

```html
<div v-if="detail.open" class="fixed inset-0 z-50 modal-overlay">
```

Ubah panel:

```html
<div class="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-lift">
```

menjadi:

```html
<div class="modal-panel max-w-4xl shadow-lift">
```

- [ ] **Step 2: Ganti body**

Ubah:

```html
<div v-else-if="detail.p" class="flex-1 overflow-y-auto px-6 py-5">
```

menjadi:

```html
<div v-else-if="detail.p" class="modal-body px-6 py-5">
```

- [ ] **Step 3: Tambah `shrink-0` pada header**

Ubah:

```html
<div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
```

(di dalam modal Detail Pengajuan) menjadi:

```html
<div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
```

Catatan: string header ini identik di keempat modal. Gunakan konteks unik — baris 896 berada tepat setelah `<div class="modal-panel max-w-4xl shadow-lift">` — untuk memastikan yang diubah hanya header modal ini.

- [ ] **Step 4: Verifikasi statis**

Run:
```bash
rg -n "max-h-\[92vh\]" new-code1/pages/dashboard.html
rg -n "v-if=\"detail.open\"" new-code1/pages/dashboard.html
```
Expected: `max-h-[92vh]` tidak ada hasil; baris `detail.open` menampilkan `class="fixed inset-0 z-50 modal-overlay"`.

Run: `node -e "const h=require('fs').readFileSync('new-code1/pages/dashboard.html','utf8'); const c=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<!--[^]*?-->/g,''); const s=c.slice(c.indexOf('MODAL: DETAIL'),c.indexOf('MODAL: MASTER')); const o=[...s.matchAll(/<div([^>]*)>/g)].filter(m=>!m[1].trim().endsWith('/')).length; const cl=[...s.matchAll(/<\/div>/g)].length; console.log('detail modal div',o,'/',cl);"` — pastikan output open == close (tag balance di section modal Detail).

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): apply modal pattern to detail pengajuan modal Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

### Task 3: Terapkan pola ke modal Master Data

**Files:**
- Modify: `new-code1/pages/dashboard.html:1027-1030` (overlay + panel), `:1035` (body), `:1031` (header), `:1058` (footer).

**Interfaces:**
- Consumes: kelas dari Task 1.
- Produces: tidak ada (berdiri sendiri).

- [ ] **Step 1: Ganti overlay + panel**

Ubah:

```html
<div v-if="master.modal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
```

menjadi:

```html
<div v-if="master.modal" class="fixed inset-0 z-50 modal-overlay">
```

Ubah panel:

```html
<div class="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-lift">
```

menjadi:

```html
<div class="modal-panel max-w-3xl shadow-lift">
```

- [ ] **Step 2: Ganti body**

Ubah:

```html
<div class="flex-1 overflow-y-auto px-6 py-4">
```

(di dalam modal Master Data, baris 1035) menjadi:

```html
<div class="modal-body px-6 py-4">
```

- [ ] **Step 3: Tambah `shrink-0` pada header & footer**

Header (baris 1031) — konteks unik: tepat setelah `<div class="modal-panel max-w-3xl shadow-lift">`:

```html
<div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
```

Footer (baris 1058):

```html
<div class="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-3.5">
```

- [ ] **Step 4: Verifikasi statis**

Run:
```bash
rg -n "max-h-\[88vh\]" new-code1/pages/dashboard.html
rg -n "v-if=\"master.modal\"" new-code1/pages/dashboard.html
```
Expected: `max-h-[88vh]` tidak ada hasil; `master.modal` menampilkan `class="fixed inset-0 z-50 modal-overlay"`.

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): apply modal pattern to master data modal Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

### Task 4: Terapkan pola ke modal Upload BA

**Files:**
- Modify: `new-code1/pages/dashboard.html:1069-1072` (overlay + panel), `:1077` (body), `:1073` (header), `:1120` (footer).

**Interfaces:**
- Consumes: kelas dari Task 1.
- Produces: tidak ada (berdiri sendiri).

- [ ] **Step 1: Ganti overlay + panel**

Ubah:

```html
<div v-if="ba.modal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
```

menjadi:

```html
<div v-if="ba.modal" class="fixed inset-0 z-50 modal-overlay">
```

Ubah panel:

```html
<div class="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-lift">
```

menjadi:

```html
<div class="modal-panel max-w-xl shadow-lift">
```

- [ ] **Step 2: Ganti body**

Ubah:

```html
<div class="px-6 py-4">
```

(di dalam modal Upload BA, baris 1077 — konteks unik: tepat setelah `<div class="modal-panel max-w-xl shadow-lift">`) menjadi:

```html
<div class="modal-body px-6 py-4">
```

- [ ] **Step 3: Tambah `shrink-0` pada header & footer**

Header (baris 1073) — konteks unik: tepat setelah panel Upload BA:

```html
<div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
```

Footer (baris 1120):

```html
<div class="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-3.5">
```

- [ ] **Step 4: Verifikasi statis**

Run:
```bash
rg -n "v-if=\"ba.modal\"" new-code1/pages/dashboard.html
rg -n "modal-panel max-w-xl" new-code1/pages/dashboard.html
```
Expected: `ba.modal` menampilkan `class="fixed inset-0 z-50 modal-overlay"`; `modal-panel max-w-xl` ada di panel Upload BA.

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): apply modal pattern to upload ba modal Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

### Task 5: Terapkan pola ke modal Konfirmasi BA

**Files:**
- Modify: `new-code1/pages/dashboard.html:649-652` (overlay + panel), `:657` (body), `:653` (header), `:671` (footer).

**Interfaces:**
- Consumes: kelas dari Task 1.
- Produces: tidak ada (berdiri sendiri).

- [ ] **Step 1: Ganti overlay + panel**

Ubah:

```html
<div v-if="bab.ba.confirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
```

menjadi:

```html
<div v-if="bab.ba.confirm" class="fixed inset-0 z-50 modal-overlay">
```

Ubah panel:

```html
<div class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-lift">
```

menjadi:

```html
<div class="modal-panel max-w-lg shadow-lift">
```

- [ ] **Step 2: Ganti body**

Ubah:

```html
<div class="px-6 py-4">
```

(di dalam modal Konfirmasi BA, baris 657 — konteks unik: tepat setelah `<div class="modal-panel max-w-lg shadow-lift">`) menjadi:

```html
<div class="modal-body px-6 py-4">
```

- [ ] **Step 3: Tambah `shrink-0` pada header & footer**

Header (baris 653) — konteks unik: tepat setelah panel Konfirmasi BA:

```html
<div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
```

Footer (baris 671):

```html
<div class="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-3.5">
```

- [ ] **Step 4: Verifikasi statis**

Run:
```bash
rg -n "v-if=\"bab\.ba\.confirm\"" new-code1/pages/dashboard.html
rg -n "modal-panel max-w-lg" new-code1/pages/dashboard.html
```
Expected: `bab.ba.confirm` menampilkan `class="fixed inset-0 z-50 modal-overlay"`; `modal-panel max-w-lg` ada di panel Konfirmasi BA.

Run pemeriksaan global kelas lama sudah bersih:
```bash
rg -n "flex items-center justify-center p-4|max-h-\[8[89]vh\]|max-h-\[92vh\]"
```
Expected: tidak ada hasil.

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): apply modal pattern to konfirmasi ba modal Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

### Task 6: Scroll-lock body via computed + watch

**Files:**
- Modify: `new-code1/pages/dashboard.html` — dalam objek Vue `createApp({...})`:
  - Tambah computed `anyModalOpen` setelah `activeMasterRows()` (baris 1434-1440), sebelum penutup `}` dari `computed` (baris 1441).
  - Tambah blok `watch` baru tepat setelah penutup `computed` (setelah baris 1441), sebelum `methods: {` (baris 1442).

**Interfaces:**
- Consumes: state `detail.open`, `ba.modal`, `master.modal`, `bab.ba.confirm` (semua sudah ada di `data()`).
- Produces: body scroll terkunci saat salah satu modal terbuka.

- [ ] **Step 1: Tambah computed `anyModalOpen`**

Di dalam blok `computed`, setelah `activeMasterRows()`:

```js
                activeMasterRows() {
                    const card = this.activeMasterCard;
                    const rows = this.master.data[card.key] || [];
                    const q = String(this.master.search || '').toLowerCase().trim();
                    if (!q) return rows;
                    return rows.filter(r => card.cols.some(c => String(r[c] === undefined || r[c] === null ? '' : r[c]).toLowerCase().indexOf(q) !== -1));
                },
                anyModalOpen() {
                    return !!(this.detail.open || this.ba.modal || this.master.modal || this.bab.ba.confirm);
                }
```

- [ ] **Step 2: Tambah blok `watch`**

Antara penutup `computed` (`},` di baris 1441) dan `methods: {` (baris 1442):

```js
            },
            watch: {
                anyModalOpen(open) {
                    document.body.style.overflow = open ? 'hidden' : '';
                }
            },
            methods: {
```

- [ ] **Step 3: Verifikasi**

Run:
```bash
rg -n "anyModalOpen" new-code1/pages/dashboard.html
```
Expected: 2 hasil (definisi di `computed`, pengguna di `watch`).

Run: `node -e "const h=require('fs').readFileSync('new-code1/pages/dashboard.html','utf8'); const start=h.indexOf('createApp({'); const end=h.indexOf('}).mount'); const s=h.slice(start,end); const b=(s.match(/\{[^{}]*\}/g)||[]).length; console.log('brace-blocks ok, total',b);"` — pastikan tidak error parse (file masih valid JS).

- [ ] **Step 4: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(dashboard): lock body scroll while any modal is open Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

### Task 7: Verifikasi akhir & uji di browser

**Files:**
- Modify: tidak ada (verifikasi).

**Interfaces:**
- Consumes: seluruh hasil Task 1-6.

- [ ] **Step 1: Verifikasi statis menyeluruh**

Run:
```bash
rg -n "modal-overlay|modal-panel|modal-body|anyModalOpen" new-code1/pages/dashboard.html
```
Expected:
- `modal-overlay`: 4 hasil (overlay 4 modal) + 1 CSS.
- `modal-panel`: 4 hasil (panel 4 modal) + 1 CSS.
- `modal-body`: 4 hasil (body 4 modal) + 1 CSS.
- `anyModalOpen`: 2 hasil (computed + watch).

Run cek tag balance seluruh file (hanya div + transition yang dihitung; tag berisi `>` di dalam atribut tidak diparsing):
```bash
node -e "const h=require('fs').readFileSync('new-code1/pages/dashboard.html','utf8'); const c=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<!--[^]*?-->/g,''); const o=[...c.matchAll(/<div([^>]*)>/g)].filter(m=>!m[1].trim().endsWith('/')).length; const cl=[...c.matchAll(/<\/div>/g)].length; const ot=[...c.matchAll(/<transition([^>]*)>/g)].filter(m=>!m[1].trim().endsWith('/')).length; const ct=[...c.matchAll(/<\/transition>/g)].length; console.log('div',o,'/',cl,'| transition',ot,'/',ct);"
```
Expected: `div 292 / 292 | transition 4 / 4` (jumlah div boleh bertambah jika 4 modal menambah elemen — yang penting open == close untuk keduanya).

- [ ] **Step 2: Uji di browser via deploy-website**

Gunakan skill `/deploy-website` untuk menjalankan proyek. Login, lalu uji pada:
- **DevTools responsive:** 320px, 375px, 414px, dan desktop ≥1024px.
- Buka tiap modal:
  - Detail Pengajuan & Master Data → panel tidak melebihi layar, body scroll internal jalan, footer/header selalu terlihat (`shrink-0`).
  - Upload BA → form panjang, **tombol Upload dapat dijangkau** (scroll body internal).
  - Konfirmasi BA → daftar peserta panjang bisa scroll, tombol Batal/Upload terlihat.
- **Scroll-lock:** saat modal terbuka, background tidak ikut scroll; setelah modal ditutup, scroll halaman kembali normal.
- **HP asli (Chrome/Brave):** verifikasi akhir oleh user di perangkatnya.

- [ ] **Step 3: Commit final (jika ada perbaikan dari uji browser)**

Hanya jika Step 2 menemukan masalah; commit perbaikan dengan pesan deskriptif, lalu ulangi Step 2.

---
