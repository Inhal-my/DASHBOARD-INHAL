# Port Redesain Mockup ke Produksi (`new-code1-cf`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menerapkan bahasa visual dan shell navigasi dari mockup `mockups/pengajuan-v2/` ke halaman produksi `public/dashboard.html` dan `public/detail-laporan.html` tanpa mengubah backend/RPC/skema D1.

**Architecture:** `detail-laporan.html` saat ini adalah halaman laporan mandiri (navbar + hero sendiri). Port mengganti navbar/hero tersebut dengan **app shell yang sama seperti dashboard** (sidebar yang bisa dilipat + topbar + bottom-nav HP + FAB + mobile menu sheet), lalu menyelaraskan tampilan 5 tab (`rekap`, `dosen`, `bagian`, `ba`, `bayar`) dengan mockup. `dashboard.html` hanya diselaraskan secara visual; shell-nya sudah ada. Tidak ada langkah build: Tailwind v3.4.17 dipakai sebagai blok `<style>` **terkompilasi yang di-inline**, jadi utility/kelas baru yang belum ada ditambahkan manual ke blok `<style>` ekstra (pola yang sudah dipakai di kedua file).

**Tech Stack:** HTML + Vue 3 (global `vue.global.prod.js`) + Tailwind (inline precompiled) + bootstrap-icons, diserve Cloudflare Worker (Hono) `new-code1-cf`. Test: vitest + `@vue/compiler-dom` + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- Copy UI berbahasa Indonesia (pertahankan istilah yang sudah ada).
- **Tanpa langkah build / tanpa CDN Tailwind / tanpa dependency runtime baru.** Tailwind adalah blok `<style>` terkompilasi (v3.4.17) yang di-inline di tiap file. Utility/kelas baru ditulis manual di blok `<style>` ekstra, bukan di file CSS eksternal.
- **Semua kelas shell harus tetap berada di dalam `<style>` inline.** Helper test `cssSelectors()` hanya membaca isi tag `<style>`.
- Jangan mengubah `public/portal.html` dan `public/bagian.html`.
- Jangan mengubah backend/RPC/skema D1, alur unggah (maks 1 file 5 MB), scan→PDF, atau biaya override. Port murni visual/UX + shell.
- Pertahankan `<div id="app" ... v-cloak>` sebagai root dan urutan blok `<script>` (`/gs-shim.js`, `/app-common.js`, vue, app script).
- Jangan menghapus string/marker yang di-assert test produksi tanpa memperbarui assert-nya secara eksplisit di task yang sama.
- Semua perintah dijalankan dari `new-code1-cf/`.
- Test: `npx vitest run`. Deploy: `CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy` (worker `inhal-form`, D1 `inhal-poc`, URL https://inhal-form.prodi.workers.dev).
- Setiap task diakhiri commit kecil. Jangan deploy sebelum Task 6.

## Baseline (fakta hasil pre-flight, jangan diasumsikan hilang)

- `detail-laporan.html` **sudah punya**: donut `Distribusi Status` (`stroke-dasharray`, line ~345), label sumbu matriks (`Baris = Dosen, kolom = Bagian`, line ~560), kolom **Aksi** pada tab BA/Pembayaran (`>Aksi</th>` lines 447/882/1061), serta kelas `.btn-acc`/`.btn-bukti` (lines 29-33). Jadi struktur 5 tab sudah setara mockup; yang kurang adalah **shell** (Task 1-3) dan penyelarasan gaya visual (Task 4-5).
- `dashboard.html` sudah punya shell lengkap; hanya perlu penyelarasan visual (Task 5).

---

### Task 1: Sisipkan CSS shell ke `detail-laporan.html`

**Files:**
- Modify: `public/detail-laporan.html` (tambahkan blok `<style>` baru sebelum `</head>`)
- Test: `test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: CSS shell yang sudah ada di `public/dashboard.html` — `.bg-sidebar` (dashboard line 16) dan blok shell dashboard lines 211-262 (`.app-shell`, `.sidebar-aside`, `.main-wrap`, `.content-wrap`, `.sidebar-toggle`, `.topbar-search`, `.topbar-bell`, `.stat-trend`, `.bottom-nav`, `.bnav-btn`, `.fab-btn`, `.sheet-overlay`, `.sheet-panel`, `.sheet-handle`, `.sheet-item`, `.sheet-divider`, `.toast-float`).
- Produces: kelas CSS yang dipakai markup Task 3.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `test/detail-laporan-template.test.js`:

```javascript
describe('detail laporan app shell (ala dashboard)', () => {
  it('mendefinisikan CSS shell responsif di blok style inline', async () => {
    const html = await loadHtml();
    const selectors = cssSelectors(html);
    for (const sel of ['.app-shell', '.sidebar-aside', '.main-wrap', '.content-wrap', '.sidebar-toggle', '.bottom-nav', '.bnav-btn', '.fab-btn', '.sheet-panel', '.sheet-item', '.topbar-search', '.topbar-bell', '.bg-sidebar', '.stat-trend']) {
      expect(selectors.has(sel)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-template.test.js -t "app shell"`
Expected: FAIL — `.app-shell`, `.bg-sidebar`, dll. belum ada di `cssSelectors`.

- [ ] **Step 3: Sisipkan CSS shell**

Di `public/detail-laporan.html`, tambahkan satu blok `<style>` baru **persis sebelum** `</head>` (setelah `</style>` di line 67), berisi:
1. Salinan `.bg-sidebar` dari `dashboard.html` line 16:
   ```css
   .bg-sidebar { background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%); }
   ```
2. Salinan **verbatim** blok shell dashboard lines 211-262 (mulai `.app-shell{ --sidebar-w: 268px; }` sampai `.toast-float ... !important; }`).

Jangan menyalin `.ba-cards`/`.heat-table` (tidak dipakai detail-laporan).

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-template.test.js`
Expected: PASS (seluruh suite detail-laporan hijau).

- [ ] **Step 5: Commit**

```bash
git add public/detail-laporan.html test/detail-laporan-template.test.js
git commit -m "feat(detail-laporan): tambah CSS app shell ala dashboard"
```

---

### Task 2: Tambahkan state & method shell ke app `detail-laporan.html`

**Files:**
- Modify: `public/detail-laporan.html` (blok `data()` dan `methods` pada app script)
- Test: `test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: kelas CSS dari Task 1.
- Produces: `sidebarCollapsed` (Boolean), `sidebarOpen` (Boolean), `mobileMenuOpen` (Boolean), method `toggleSidebar()`, `switchTab(key)`, `toggleMobileMenu()`; dipakai markup Task 3.

- [ ] **Step 1: Tulis test yang gagal**

```javascript
describe('detail laporan shell interaktif', () => {
  it('menyediakan state dan aksi shell', async () => {
    const html = await loadHtml();
    expect(html).toContain('sidebarCollapsed: false');
    expect(html).toContain('sidebarOpen: false');
    expect(html).toContain('mobileMenuOpen: false');
    expect(html).toContain('this.sidebarCollapsed = !this.sidebarCollapsed');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-template.test.js -t "shell interaktif"`
Expected: FAIL.

- [ ] **Step 3: Implementasi state & method**

Periksa dulu apakah `switchTab`/`sidebarCollapsed` sudah ada:
```
rg -n "switchTab|sidebarCollapsed|activeTab:" public/detail-laporan.html
```
Jika sudah ada, jangan duplikasi — cukup tambahkan yang belum ada. Di `data()` tambahkan:

```javascript
      sidebarCollapsed: false,
      sidebarOpen: false,
      mobileMenuOpen: false,
```

Di `methods` tambahkan:

```javascript
      toggleSidebar() { this.sidebarCollapsed = !this.sidebarCollapsed; },
      toggleMobileMenu() { this.mobileMenuOpen = !this.mobileMenuOpen; },
      switchTab(key) { this.activeTab = key; this.mobileMenuOpen = false; this.sidebarOpen = false; },
```

Catatan: assertion memakai bentuk `this.sidebarCollapsed = !this.sidebarCollapsed` (bukan substring inline dashboard) supaya cocok dengan body method. Ketiga method ini **wajib dipakai** oleh Task 3 (tombol shell memakai `@click="toggleSidebar()"`/`@click="toggleMobileMenu()"` dan tab memakai `@click="switchTab(n.key)"`), sehingga tidak menjadi dead code.

`activeTab` sudah ada di produksi; **jangan** didefinisikan ulang.

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-template.test.js -t "shell interaktif"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/detail-laporan.html test/detail-laporan-template.test.js
git commit -m "feat(detail-laporan): state dan method interaksi app shell"
```

---

### Task 3: Ganti navbar + hero `detail-laporan.html` dengan app shell

**Files:**
- Modify: `public/detail-laporan.html` (root `#app` line 73; ganti blok `<!-- navbar -->` lines 169-188 dan `<!-- hero -->` lines 192-207; bungkus `main`)
- Test: `test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: CSS Task 1, state/method Task 2.
- Produces: markup shell; `activeTab` tetap dipakai section tab yang sudah ada (lines 314, 495, 637, 819, 995).

- [ ] **Step 1: Tulis test yang gagal**

```javascript
describe('detail laporan memakai app shell', () => {
  it('merender sidebar, topbar, bottom-nav, dan FAB', async () => {
    const html = await loadHtml();
    expect(html).toContain('class="app-shell font-sans text-ink antialiased"');
    expect(html).toContain(":class=\"sidebarCollapsed ? 'sidebar-collapsed' : ''\"");
    expect(html).toContain('sidebar-aside');
    expect(html).toContain('main-wrap');
    expect(html).toContain('content-wrap');
    expect(html).toContain('sidebar-toggle');
    expect(html).toContain('bottom-nav');
    expect(html).toContain('bnav-btn');
    expect(html).toContain('fab-btn');
    expect(html).toContain('topbar-search');
    expect(html).toContain('topbar-bell');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-template.test.js -t "memakai app shell"`
Expected: FAIL.

- [ ] **Step 3: Implementasi shell**

Ubah root `#app`:
```html
    <div id="app" v-cloak class="app-shell font-sans text-ink antialiased"
        :class="sidebarCollapsed ? 'sidebar-collapsed' : ''">
```

Ganti blok `<!-- navbar -->` (lines 169-188) dan `<!-- hero -->` (lines 192-207) dengan shell. Sumber **verbatim** ada di `dashboard.html`; sesuaikan teks/route:
- **Mobile backdrop + SIDEBAR**: salin `dashboard.html` lines 358-415. Judul sidebar jadi `Laporan INHAL` / `Laporan &amp; Berita Acara`. Item menu: `v-for="n in tabs"` (array `tabs` yang sudah ada di lines 1416-1422), `:class="activeTab===n.key ? 'bg-white/10 text-white' : ...'"`, `@click.prevent="switchTab(n.key)"`, ikon `n.icon`, label `n.label`. Link bawah sidebar `/detail-laporan` → `/dashboard` (label `Dashboard`). **Penting:** tombol `.sidebar-toggle` JANGAN memakai inline handler dashboard (`@click="sidebarCollapsed = !sidebarCollapsed"`); gunakan `@click="toggleSidebar()"` supaya method Task 2 tidak jadi dead code.
- **Topbar header**: salin `dashboard.html` lines 418-442. `pageTitle` → label tab aktif (`tabs.find(t=>t.key===activeTab)?.label`), subjudul `Rekapitulasi &amp; Berita Acara`. Link `/detail-laporan` di topbar → `/dashboard` (label `Dashboard`).
- **bottom-nav + FAB + mobile menu sheet**: salin markup terkait dari `dashboard.html` (cari `bottom-nav`, `fab-btn`, `mobileMenuOpen`), sesuaikan 5 tombol ke 5 tab laporan (`switchTab(t.key)`), dan tombol Menu memakai `@click="toggleMobileMenu()"`.
- **Ubah tab switcher lama** (line ~357, `@click="activeTab = t.key"`) menjadi `@click="switchTab(t.key)"` supaya reset `mobileMenuOpen`/`sidebarOpen` ikut jalan dan `switchTab` terpakai.
- **Bungkus konten**: `<main v-if="loggedIn" class="main-wrap min-h-screen">` + di dalamnya `<div class="content-wrap p-4 md:p-6 lg:p-8"> ... seluruh isi konten tab ... </div>`.
- **Pindahkan filter** (lines 210-297) ke dalam `content-wrap`, tepat setelah pembuka `content-wrap`.
- **Hapus** brand/logo navbar lama dan hero lama (sudah digantikan shell + judul topbar).

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-template.test.js`
Expected: PASS — termasuk test kompilasi Vue (tanpa template error) dan seluruh test tab lama.

- [ ] **Step 5: Commit**

```bash
git add public/detail-laporan.html test/detail-laporan-template.test.js
git commit -m "feat(detail-laporan): ganti navbar/hero dengan app shell dashboard"
```

---

### Task 4: Selaraskan gaya visual 5 tab `detail-laporan.html` dengan mockup

Task ini murni visual (struktur/binding sudah setara mockup). Gate: **regression guard** + verifikasi preview. Tidak ada perilaku baru, jadi tidak ada test TDD yang gagal-dulu; guard ditambahkan dan harus tetap lulus sebelum & sesudah.

**Files:**
- Modify: `public/detail-laporan.html` (section tab: `rekap` line 314, `dosen` line 495, `bagian` line 637, `ba` line 819, `bayar` line 995)
- Test: `test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: kelas util yang sudah ada; boleh menambah kelas baru ke blok `<style>` ekstra.
- Produces: tampilan tab sesuai mockup, tanpa mengubah computed/method.

- [ ] **Step 1: Tambahkan regression guard (harus hijau sekarang)**

```javascript
describe('detail laporan struktur tab terjaga setelah restyle', () => {
  it('pertahankan donut, matriks, dan kolom Aksi', async () => {
    const html = await loadHtml();
    expect(html).toContain('Distribusi Status');
    expect(html).toContain('stroke-dasharray');
    expect(html).toContain('Baris = Dosen, kolom = Bagian');
    expect(html).toContain('>Aksi</th>');
    expect(html).toContain('btn-acc');
    expect(html).toContain('btn-bukti');
  });
});
```

- [ ] **Step 2: Konfirmasi guard hijau sebagai baseline**

Run: `npx vitest run test/detail-laporan-template.test.js -t "struktur tab terjaga"`
Expected: PASS (baseline; guard ini harus tetap PASS setelah restyle).

- [ ] **Step 3: Terapkan penyelarasan visual**

Untuk setiap tab, bandingkan markup produksi dengan bagian render mockup di `mockups/pengajuan-v2/laporan-detail.html`, lalu samakan spacing/kartu/heading/tabel:
- Tab `rekap` (mockup mulai blok `lapstats`/`donutwrap`, lines 745-791): 6 kartu ringkasan, donut + legend, bar jenis/blok, chips, tabel.
- Tab `dosen` & `bagian`: matriks (header sticky, sel hover, chip), panel detail `dosen-detail`/`bagian-detail`.
- Tab `ba`: chip Pendukung/Pelaksanaan + aksi.
- Tab `bayar`: sel expandable + tombol `btn-bukti`/`btn-acc`.

Gunakan kelas util yang sudah ada (mis. `rounded-2xl bg-white shadow-soft ring-1 ring-slate-100`, `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`). Tambahkan kelas baru ke blok `<style>` ekstra bila perlu. **Pertahankan** semua `{{ }}` binding, method/computed (`dosenSuggestionsList`, `dosenOptions`, `activeDosenCell`, `activeMatrixCell`, `baKegiatanRows`, `pembayaranRows`, `bayarBuktiUrl`, `openKelolaBa`, `deleteBaAdmin`), dan seluruh marker test lama.

- [ ] **Step 4: Jalankan test untuk memastikan tetap lulus**

Run: `npx vitest run test/detail-laporan-template.test.js`
Expected: PASS (guard + seluruh test lama).

- [ ] **Step 5: Verifikasi visual di preview**

Jalankan `python3 -m http.server 5500 --bind 0.0.0.0` dari root repo, buka halaman dengan mode 5 tab pada lebar < 1024px dan >= 1024px. Bandingkan dengan mockup; tidak ada error console.

- [ ] **Step 6: Commit**

```bash
git add public/detail-laporan.html test/detail-laporan-template.test.js
git commit -m "style(detail-laporan): selaraskan visual 5 tab dengan mockup"
```

---

### Task 5: Selaraskan gaya visual `dashboard.html` dengan mockup

Murni visual; shell & perilaku tidak berubah. Gate: regression guard + preview.

**Files:**
- Modify: `public/dashboard.html`
- Test: `test/dashboard-template.test.js`

**Interfaces:**
- Consumes: shell yang sudah ada.
- Produces: tampilan konsisten dengan mockup `index.html`; perilaku tidak berubah.

- [ ] **Step 1: Konfirmasi baseline hijau**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: PASS (baseline seluruh test dashboard).

- [ ] **Step 2: Terapkan penyelarasan visual**

Bandingkan `dashboard.html` dengan `mockups/pengajuan-v2/index.html` (shell, kartu statistik, tabel, drawer 3 tahap). Samakan spacing/heading/kartu/chip. Kelas util baru ditambahkan ke blok `<style>` ekstra (lines 167-210). **Jangan** mengubah struktur shell, nama state/method, atau marker yang di-assert test.

- [ ] **Step 3: Jalankan test untuk memastikan tidak ada regresi**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 4: Verifikasi visual di preview**

Buka `/dashboard.html` di preview, bandingkan dengan mockup pada mobile & desktop; tidak ada error console.

- [ ] **Step 5: Commit**

```bash
git add public/dashboard.html
git commit -m "style(dashboard): selaraskan visual dengan mockup redesain"
```

---

### Task 6: QA responsif + verifikasi menyeluruh + deploy

**Files:**
- Test: `test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: seluruh task sebelumnya.
- Produces: build teruji & ter-deploy.

- [ ] **Step 1: Tambah test responsif**

```javascript
describe('detail laporan responsif', () => {
  it('bottom-nav/FAB hanya layar kecil, sidebar layar besar', async () => {
    const html = await loadHtml();
    const selectors = cssSelectors(html);
    expect(selectors.has('.bottom-nav')).toBe(true);
    expect(selectors.has('.fab-btn')).toBe(true);
    expect(html).toContain('lg:hidden');
  });
});
```

- [ ] **Step 2: Jalankan seluruh test**

Run: `npx vitest run`
Expected: seluruh suite PASS (baseline 38 suite / 336 test + tambahan baru).

- [ ] **Step 3: Verifikasi manual di preview**

Cek `/dashboard.html` dan `/detail-laporan` pada lebar < 1024px dan >= 1024px: sidebar bisa dilipat, bottom-nav/FAB hanya di mobile, tidak ada error console, 5 tab detail-laporan berfungsi.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "test(detail-laporan): guard responsif app shell"
```

- [ ] **Step 5: Deploy production**

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```
Expected: worker `inhal-form` ter-deploy sukses.

---

## Self-Review

**Spec coverage:** Shell detail-laporan (Task 1-3), penyelarasan visual 5 tab detail-laporan (Task 4), penyelarasan visual dashboard (Task 5), QA responsif + deploy (Task 6). Backend/scan/biaya sengaja tidak disentuh (Global Constraints) — konsisten dengan "port visual/UX saja".

**Placeholder scan:** Tidak ada TODO/TBD. Bagian yang harus disalin ditunjuk lewat rentang baris konkret di `public/dashboard.html`. Task visual memakai regression guard + verifikasi preview, bukan test klas yang mengada-ada.

**Type consistency:** State/method (`sidebarCollapsed`, `sidebarOpen`, `mobileMenuOpen`, `toggleSidebar`, `switchTab`, `toggleMobileMenu`) konsisten di Task 2-3. Kelas shell (`.app-shell`, `.sidebar-aside`, `.main-wrap`, `.content-wrap`, `.bottom-nav`, `.fab-btn`, `.topbar-search`, `.topbar-bell`, `.stat-trend`) sama dengan yang di-assert test dashboard, menjaga paritas.

## Catatan Asumsi

1. `detail-laporan.html` berhenti memakai navbar/hero sendiri dan memakai shell dashboard (disetujui; detail-laporan didelegasikan ke pelaksana).
2. Label/konten 5 tab tetap sama dengan produksi; mockup dipakai sebagai acuan **visual**.
3. Task 4-5 murni visual: verifikasinya regression guard + perbandingan preview, bukan test perilaku baru.
