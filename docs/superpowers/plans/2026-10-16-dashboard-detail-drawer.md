# Drawer Detail Pengajuan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti modal detail pengajuan di `new-code1-cf/public/dashboard.html` menjadi drawer kanan berstepper 3 langkah (Identitas → Berkas → Keputusan) sesuai `mockups/pengajuan-v2/index.html`, tanpa kehilangan kemampuan produksi.

**Architecture:** Satu file HTML berisi template Vue 2 (in-DOM) + blok `<style>` hand-maintained (Tailwind pra-kompilasi, TIDAK ada JIT). Semua tampilan drawer memakai primitif CSS baru ber-prefix `pd-*` yang didefinisikan manual di blok `<style>` pertama, ditambah kelas yang sudah ada (`btn-*`, `label`, `value`, `input`, `link`). State `detail.step` mengendalikan langkah; method `setDetailStep(n)` menggantinya.

**Tech Stack:** Vue 2 in-DOM template, Cloudflare Workers static assets, Vitest (`cloudflare:test` + `@vue/compiler-dom`).

## Global Constraints

- Target file tunggal: `new-code1-cf/public/dashboard.html`. Jangan menyentuh file lain selain yang disebut tiap task.
- Status valid: `Menunggu`, `ACC`, `Ditolak`, `Dibatalkan`. **String `Diterima` tidak boleh muncul di dashboard** (dijaga test `expect(html).not.toContain('Diterima')`).
- Tailwind sudah dikompilasi; **kelas Tailwind baru tidak akan punya CSS**. Semua gaya baru wajib lewat primitif `pd-*` yang didefinisikan manual, atau kelas yang sudah dipakai di file.
- Nama method/field produksi tidak boleh diubah: `applyDetailFromRow`, `openDetail`, `reloadDetail`, `startEditInduk`, `cancelEditInduk`, `saveIndukFields`, `startEditDetail`, `cancelEditDetail`, `saveDetailRow`, `deleteDetailRow`, `onSuratFile`, `uploadSurat`, `onBuktiFile`, `uploadBuktiBayar`, `scanOnPhotos`, `scanBuildPdf`, `scanClear`, `scanMove`, `scanRemove`, `openKelolaBaPendukung`, `updateStatus`, `quickStatus`, `sendFinalEmail`, `sendAccFinalToBagian`, `deletePengajuan`, `isManual`, `statusBadge`, `safeUrl`, `formatTanggal`, `formatTanggalWaktu`, `formatRupiah`.
- State `detail` tetap memuat semua field lama (`open, loading, p, suratFile, suratName, suratUploading, suratError, buktiFile, buktiUploading, buktiError, scanItems, scanBusy, scanSeq, status, catatan, editInduk, iForm, editDetailIndex, dEdit`).
- Perintah test: `npx vitest run test/dashboard-template.test.js` (single file) dan `npm test` (suite penuh), dijalankan dari `new-code1-cf`.

---

### Task 1: Primitif CSS `pd-*`, state `detail.step`, dan method `setDetailStep`

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (blok `<style>` pertama; state `detail`; method `applyDetailFromRow`/`openDetail` area)
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: tidak ada.
- Produces: `setDetailStep(n)` (method, `n: number`, tidak mengembalikan nilai); state `detail.step` (number, default `0`); kelas CSS `.pd-overlay`, `.pd-drawer`, `.pd-drawer.open`, `.pd-head`, `.pd-head-top`, `.pd-avatar`, `.pd-id`, `.pd-close`, `.pd-steps`, `.pd-step`, `.pd-step.active`, `.pd-step.done`, `.pd-body`, `.pd-foot`, `.pd-card`, `.pd-card-head`, `.pd-card-body`, `.pd-grid2`, `.pd-grid3`, `.pd-keg`, `.pd-mini-ic`, `.pd-doc-row`, `.pd-doc-ic`, `.pd-doc-info`, `.pd-pill-ok`, `.pd-pill-no`, `.pd-upzone`, `.pd-statuspick`, `.pd-manual-note`, `.pd-progress`, `.pd-email-box`, `.pd-scan-grid`, `.pd-scan-item`.

- [ ] **Step 1: Write the failing test**

Tambahkan blok `describe` baru di akhir `new-code1-cf/test/dashboard-template.test.js` (setelah `describe('guard alur status dashboard', ...)`):

```javascript
describe('dashboard detail drawer primitives', () => {
  it('mendefinisikan primitif CSS pd-* dan helper stepper', async () => {
    const html = await loadDashboardHtml();
    const selectors = cssSelectors(html);
    for (const sel of ['.pd-overlay', '.pd-drawer', '.pd-head', '.pd-head-top', '.pd-avatar',
      '.pd-id', '.pd-close', '.pd-steps', '.pd-step', '.pd-step.active', '.pd-step.done',
      '.pd-body', '.pd-foot', '.pd-card', '.pd-card-head', '.pd-card-body', '.pd-grid2',
      '.pd-grid3', '.pd-keg', '.pd-mini-ic', '.pd-doc-row', '.pd-doc-ic', '.pd-doc-info',
      '.pd-pill-ok', '.pd-pill-no', '.pd-upzone', '.pd-statuspick', '.pd-manual-note',
      '.pd-progress', '.pd-email-box', '.pd-scan-grid', '.pd-scan-item']) {
      expect(selectors.has(sel)).toBe(true);
    }
    expect(html).toContain('setDetailStep(n) {');
    expect(html).toContain('this.detail.step = Math.max(0, Math.min(2, n));');
    expect(html).toContain('step: 0,');
    expect(html).toContain('this.detail.step = 0;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "mendefinisikan primitif CSS pd-*"`
Expected: FAIL — `.pd-overlay` belum ada, `setDetailStep(n)` belum ada.

- [ ] **Step 3: Tambah primitif CSS `pd-*`**

Edit `new-code1-cf/public/dashboard.html`. Ganti blok penutup `<style>` pertama (baris ~144-148):

Old:
```html
        @media (min-width: 768px) {
            .ba-mobile { display: none; }
            .ba-desktop { display: block; }
        }
    </style>
```

New:
```html
        @media (min-width: 768px) {
            .ba-mobile { display: none; }
            .ba-desktop { display: block; }
        }
        /* ---------- Drawer Detail Pengajuan (pd-*) ---------- */
        .pd-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(15,23,42,.45); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
        .pd-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 51; width: 600px; max-width: 100%; background: #f7f8fc; display: flex; flex-direction: column; transform: translateX(105%); transition: transform .26s cubic-bezier(.22,1,.36,1); box-shadow: var(--shadow-lift); }
        .pd-drawer.open { transform: translateX(0); }
        .pd-head { flex: 0 0 auto; background: #fff; border-bottom: 1px solid var(--line); padding: 16px 20px 0; }
        .pd-head-top { display: flex; align-items: flex-start; gap: 12px; }
        .pd-avatar { width: 46px; height: 46px; border-radius: 999px; display: grid; place-items: center; flex: 0 0 auto; color: #fff; font-weight: 800; font-size: 15px; }
        .pd-id { min-width: 0; flex: 1; }
        .pd-id h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--ink-900); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pd-id .meta { font-size: 12px; color: var(--ink-400); margin-top: 2px; }
        .pd-close { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: var(--ink-400); flex: 0 0 auto; }
        .pd-close:hover { background: #f1f5f9; color: var(--ink-700); }
        .pd-steps { display: flex; gap: 6px; margin: 16px 0 0; }
        .pd-step { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 8px 13px; border-bottom: 2.5px solid transparent; color: var(--ink-400); font-size: 12.5px; font-weight: 700; transition: .15s; cursor: pointer; }
        .pd-step .n { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: #e2e8f0; color: var(--ink-500); }
        .pd-step.done .n { background: var(--emerald-soft); color: var(--emerald); }
        .pd-step.active { color: var(--brand); border-bottom-color: var(--brand); }
        .pd-step.active .n { background: var(--brand); color: #fff; }
        .pd-body { flex: 1; overflow-y: auto; padding: 20px; }
        .pd-foot { flex: 0 0 auto; background: #fff; border-top: 1px solid var(--line); padding: 13px 20px; display: flex; align-items: center; gap: 10px; }
        .pd-foot .spacer { flex: 1; }
        .pd-card { background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-soft); margin-bottom: 16px; }
        .pd-card:last-child { margin-bottom: 0; }
        .pd-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
        .pd-card-head h4 { margin: 0; font-size: 13.5px; font-weight: 800; color: var(--ink-900); display: flex; align-items: center; gap: 8px; }
        .pd-card-body { padding: 16px; }
        .pd-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
        .pd-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px 18px; }
        .pd-keg { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: #fcfcfe; margin-bottom: 9px; }
        .pd-keg:last-child { margin-bottom: 0; }
        .pd-keg .t { font-size: 13.5px; font-weight: 700; color: var(--ink-900); }
        .pd-keg .d { font-size: 12px; color: var(--ink-500); margin-top: 2px; }
        .pd-keg .m { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; font-size: 11px; color: var(--ink-400); }
        .pd-mini-ic { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-400); flex: 0 0 auto; }
        .pd-mini-ic:hover { background: #f1f5f9; color: var(--ink-700); }
        .pd-mini-ic.danger:hover { background: var(--rose-soft); color: var(--rose); }
        .pd-doc-row { display: flex; align-items: center; gap: 13px; padding: 14px; border: 1px solid var(--line); border-radius: 13px; margin-bottom: 11px; background: #fff; }
        .pd-doc-row:last-child { margin-bottom: 0; }
        .pd-doc-ic { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; font-size: 18px; flex: 0 0 auto; }
        .pd-doc-ic.surat { background: var(--brand-soft); color: var(--brand); }
        .pd-doc-ic.acc { background: var(--emerald-soft); color: var(--emerald); }
        .pd-doc-ic.bukti { background: #fff7ed; color: #ea580c; }
        .pd-doc-info { min-width: 0; flex: 1; }
        .pd-doc-info .t { font-size: 13.5px; font-weight: 700; color: var(--ink-900); }
        .pd-doc-info .s { font-size: 11.5px; color: var(--ink-400); margin-top: 2px; }
        .pd-pill-ok { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; background: var(--emerald-soft); color: var(--emerald); font-size: 11px; font-weight: 800; }
        .pd-pill-no { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; background: #f1f5f9; color: var(--ink-500); font-size: 11px; font-weight: 800; }
        .pd-upzone { border: 2px dashed #cbd5e1; border-radius: 14px; padding: 16px; text-align: center; color: var(--ink-500); font-size: 12.5px; background: #fcfcfe; }
        .pd-upzone .lead { font-size: 24px; color: var(--brand); display: block; margin-bottom: 5px; }
        .pd-upzone .hint { font-size: 11px; color: var(--ink-400); margin-top: 5px; }
        .pd-upzone .row { display: flex; gap: 8px; justify-content: center; margin-top: 11px; flex-wrap: wrap; }
        .pd-statuspick { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .pd-statuspick button { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; border: 1.5px solid var(--line); background: #fff; text-align: left; transition: .15s; }
        .pd-statuspick button .ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-size: 16px; }
        .pd-statuspick button .t { font-size: 13px; font-weight: 800; color: var(--ink-900); }
        .pd-statuspick button .s { font-size: 11px; color: var(--ink-400); }
        .pd-statuspick button.on { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
        .pd-statuspick button[data-s="Menunggu"] .ic { background: var(--amber-soft); color: var(--amber); }
        .pd-statuspick button[data-s="ACC"] .ic { background: var(--emerald-soft); color: var(--emerald); }
        .pd-statuspick button[data-s="Ditolak"] .ic { background: var(--rose-soft); color: var(--rose); }
        .pd-statuspick button[data-s="Dibatalkan"] .ic { background: #f1f5f9; color: var(--ink-500); }
        .pd-manual-note { display: flex; align-items: center; gap: 8px; background: var(--violet-soft); color: var(--violet); border-radius: 12px; padding: 12px; font-size: 12.5px; font-weight: 600; margin-bottom: 16px; }
        .pd-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .pd-progress .t { font-size: 13px; font-weight: 700; color: var(--ink-700); }
        .pd-progress .track { flex: 1; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
        .pd-progress .fill { height: 100%; background: var(--emerald); transition: width .3s ease; }
        .pd-progress .num { font-size: 12px; font-weight: 800; color: var(--emerald); }
        .pd-email-box { background: #f8fafc; border: 1px solid var(--line); border-radius: 12px; padding: 13px; font-size: 12px; }
        .pd-email-box .kv { display: grid; grid-template-columns: 130px 1fr; gap: 6px 10px; }
        .pd-email-box .kv .k { color: var(--ink-400); font-weight: 600; }
        .pd-scan-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
        .pd-scan-item { position: relative; overflow: hidden; border-radius: 8px; box-shadow: inset 0 0 0 1px #e2e8f0; }
        @media (max-width: 768px) {
            .pd-drawer { top: auto; height: 94vh; width: 100%; border-radius: 20px 20px 0 0; transform: translateY(105%); }
            .pd-drawer.open { transform: translateY(0); }
            .pd-head { padding-top: 10px; }
            .pd-head::before { content: ""; display: block; width: 42px; height: 4px; border-radius: 999px; background: #cbd5e1; margin: 0 auto 12px; }
            .pd-grid2, .pd-grid3 { grid-template-columns: 1fr; }
            .pd-statuspick { grid-template-columns: 1fr; }
            .pd-step .lbl { display: none; }
            .pd-step { gap: 0; }
            .pd-scan-grid { grid-template-columns: repeat(3, 1fr); }
        }
    </style>
```

- [ ] **Step 4: Tambah state `detail.step` dan method `setDetailStep`**

Edit dua tempat di `new-code1-cf/public/dashboard.html`.

(a) State `detail` — ganti awal baris (baris ~2319):

Old:
```javascript
                     detail: { open: false, loading: false, p: null, suratFile: null,
```
New:
```javascript
                     detail: { open: false, step: 0, loading: false, p: null, suratFile: null,
```

(b) Reset + method — di akhir `applyDetailFromRow`, ganti:

Old:
```javascript
                    this.detail.open = true;
                    this.detail.loading = false;
                },
                onSuratFile(e) {
```
New:
```javascript
                    this.detail.open = true;
                    this.detail.loading = false;
                    this.detail.step = 0;
                },
                setDetailStep(n) {
                    this.detail.step = Math.max(0, Math.min(2, n));
                },
                onSuratFile(e) {
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "mendefinisikan primitif CSS pd-*"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "feat(dashboard): primitives, state, dan stepper untuk drawer detail"
```

---

### Task 2: Ganti modal detail menjadi drawer + stepper 3 langkah

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (blok `<!-- ============ MODAL: DETAIL PENGAJUAN ============ -->`; tambah computed `berkasProgress`)
- Test: `new-code1-cf/test/dashboard-template.test.js` (tambah blok baru; sesuaikan 2 asersi lama)

**Interfaces:**
- Consumes: `detail.step`, `setDetailStep(n)`, semua kelas `pd-*` dari Task 1.
- Produces: computed `berkasProgress()` (no-arg, number 0-3) di blok `computed`; markup drawer dengan `class="pd-drawer"`, `data-step="0|1|2"`.

- [ ] **Step 1: Write the failing test**

Tambahkan blok `describe` baru di akhir `new-code1-cf/test/dashboard-template.test.js`:

```javascript
describe('dashboard detail drawer', () => {
  it('memakai drawer pd-* dengan stepper 3 langkah', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('class="pd-drawer"');
    expect(html).toContain('class="pd-overlay"');
    expect(html).toContain('class="pd-steps"');
    expect(html).toContain('data-step="0"');
    expect(html).toContain('data-step="1"');
    expect(html).toContain('data-step="2"');
    expect(html).toContain('>Identitas<');
    expect(html).toContain('>Berkas<');
    expect(html).toContain('>Keputusan<');
    expect(html).toContain('Lanjut ke Berkas');
    expect(html).toContain('Lanjut ke Keputusan');
    expect(html).not.toContain('modal-panel max-w-4xl');
  });

  it('mempertahankan kemampuan produksi di langkah-langkah', async () => {
    const html = await loadDashboardHtml();
    for (const s of [
      "openKelolaBaPendukung(detail.p['ID Pengajuan'])",
      'uploadBuktiBayar()', 'onBuktiFile($event)', 'ref="buktiCamera"',
      "scanOnPhotos($event, 'bukti')", "scanBuildPdf('bukti')", "scanClear('bukti')",
      'updateStatus()', "quickStatus('ACC')", "quickStatus('Ditolak')",
      'sendFinalEmail()', 'sendAccFinalToBagian()', 'deletePengajuan()',
      'Unggah Bukti Bayar (oleh Admin)', 'uploadSurat', 'onSuratFile',
      'startEditDetail(i)', 'deleteDetailRow(i)', 'startEditInduk()', 'saveIndukFields()',
      'cancelEditDetail()', 'Berita Acara Pendukung', 'berkasProgress'
    ]) {
      expect(html).toContain(s);
    }
  });

  it('tidak memuat status Diterima di panel keputusan', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('data-s="Diterima"');
    expect(html).not.toContain('>Diterima<');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "memakai drawer pd-*"`
Expected: FAIL — `class="pd-drawer"` belum ada.

- [ ] **Step 3: Tambah computed `berkasProgress`**

Edit `new-code1-cf/public/dashboard.html`. Ganti awal `biayaOptions` (baris ~2381):

Old:
```javascript
                biayaOptions() {
                    const seen = {};
```
New:
```javascript
                berkasProgress() {
                    const p = this.detail.p;
                    if (!p) return 0;
                    return [p['Link Surat Keterangan'], p['Link ACC INHAL'], p['Link Bukti Bayar']].filter(Boolean).length;
                },
                biayaOptions() {
                    const seen = {};
```

- [ ] **Step 4: Ganti blok markup modal detail dengan drawer**

Edit `new-code1-cf/public/dashboard.html`. Ganti seluruh blok dari baris `<!-- ============ MODAL: DETAIL PENGAJUAN ============ -->` (baris ~1782) sampai `</transition>` penutupnya (baris ~1999) — TEPAT blok berikut (baca ulang file untuk memastikan rentang; blok lama berisi `modal-panel max-w-4xl`).

Dengan markup berikut:

```html
        <!-- ============ DRAWER: DETAIL PENGAJUAN ============ -->
        <transition name="fade">
            <div v-if="detail.open" class="pd-overlay" @click.self="detail.open=false">
                <aside class="pd-drawer" :class="{ open: detail.open }">
                    <div class="pd-head">
                        <div class="pd-head-top">
                            <div class="pd-avatar" :style="{ background: pengajuanAvatarColor(detail.p && detail.p['Nama Lengkap']) }">{{ pengajuanInitials(detail.p && detail.p['Nama Lengkap']) }}</div>
                            <div class="pd-id">
                                <h3>
                                    <span>{{ detail.p ? detail.p['Nama Lengkap'] : 'Detail Pengajuan' }}</span>
                                    <span v-if="detail.p" :class="statusBadge(detail.p.Status)">{{ detail.p.Status }}</span>
                                </h3>
                                <div class="meta" v-if="detail.p"><span class="font-mono">{{ detail.p.NPM }}</span> &middot; {{ detail.p['Jenis Kegiatan'] }} &middot; {{ detail.p.Blok }} &middot; <span class="font-mono">{{ detail.p['ID Pengajuan'] }}</span></div>
                            </div>
                            <button class="pd-close" @click="detail.open=false"><i class="bi bi-x-lg"></i></button>
                        </div>
                        <div class="pd-steps">
                            <button type="button" class="pd-step" :class="{ active: detail.step===0, done: detail.step>0 }" data-step="0" @click="setDetailStep(0)"><span class="n">1</span><span class="lbl">Identitas</span></button>
                            <button type="button" class="pd-step" :class="{ active: detail.step===1, done: detail.step>1 }" data-step="1" @click="setDetailStep(1)"><span class="n">2</span><span class="lbl">Berkas</span></button>
                            <button type="button" class="pd-step" :class="{ active: detail.step===2 }" data-step="2" @click="setDetailStep(2)"><span class="n">3</span><span class="lbl">Keputusan</span></button>
                        </div>
                    </div>

                    <div class="pd-body">
                        <div v-if="detail.loading" class="flex items-center justify-center py-16">
                            <svg class="h-6 w-6 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                            <span class="ml-3 text-sm font-semibold text-slate-500">Memuat detail...</span>
                        </div>
                        <template v-else-if="detail.p">

                            <!-- STEP 0: IDENTITAS -->
                            <template v-if="detail.step===0">
                                <div class="pd-card">
                                    <div class="pd-card-head">
                                        <h4><i class="bi bi-person-badge text-brand-600"></i> Data Mahasiswa</h4>
                                        <button v-if="!detail.editInduk" class="btn-soft !px-3 !py-1.5 text-xs" @click="startEditInduk()"><i class="bi bi-pencil-square"></i>Edit</button>
                                    </div>
                                    <div class="pd-card-body">
                                        <div v-if="!detail.editInduk" class="pd-grid3">
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
                                            <div style="grid-column:1/-1"><div class="label">Keterangan</div><div class="value">{{ detail.p.Keterangan || '—' }}</div></div>
                                        </div>
                                        <div v-else class="pd-grid3">
                                            <div><div class="label">NPM</div><div class="value font-semibold">{{ detail.p.NPM }}</div></div>
                                            <div><div class="label">Nama Lengkap</div><div class="value font-semibold">{{ detail.p['Nama Lengkap'] }}</div></div>
                                            <div><label class="label">Email</label><input v-model="detail.iForm.email" type="email" class="input"></div>
                                            <div><label class="label">No. HP/WA</label><input v-model="detail.iForm.noHp" class="input"></div>
                                            <div><label class="label">Blok</label><input v-model="detail.iForm.blok" class="input"></div>
                                            <div><label class="label">Jenis Kegiatan</label><input v-model="detail.iForm.jenisKegiatan" class="input"></div>
                                            <div><label class="label">Tanggal Pelaksanaan</label><input v-model="detail.iForm.tanggalPelaksanaan" type="datetime-local" class="input"></div>
                                            <div><label class="label">Biaya</label><select v-model="detail.iForm.biaya" class="input"><option value="">Default (Master Biaya)</option><option v-for="b in biayaOptions" :key="b" :value="String(b)">{{ formatRupiah(b) }}</option></select></div>
                                            <div class="flex items-end gap-2" style="grid-column:1/-1">
                                                <button class="btn-primary" @click="saveIndukFields()"><i class="bi bi-save"></i>Simpan</button>
                                                <button class="btn-soft" @click="cancelEditInduk()">Batal</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div v-if="detail.p.details && detail.p.details.length" class="pd-card">
                                    <div class="pd-card-head"><h4><i class="bi bi-list-check text-brand-600"></i> Detail Kegiatan</h4></div>
                                    <div class="pd-card-body">
                                        <div v-for="(d, i) in detail.p.details" :key="i" class="pd-keg">
                                            <div v-if="detail.editDetailIndex !== i" class="flex-1 min-w-0">
                                                <div class="t">{{ d.Pilihan }}</div>
                                                <div class="d">{{ d.Detail }}</div>
                                                <div class="m"><span><i class="bi bi-tag"></i> {{ d['Jenis Kegiatan'] }}</span><span><i class="bi bi-calendar3"></i> {{ formatTanggal(d['Tanggal Pelaksanaan']) }}</span><span><i class="bi bi-diagram-3"></i> {{ d.Bagian }}</span></div>
                                            </div>
                                            <div v-else class="flex-1">
                                                <div class="pd-grid2">
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
                                            <div v-if="detail.editDetailIndex !== i" class="flex shrink-0 items-center gap-1">
                                                <button class="pd-mini-ic" @click="startEditDetail(i)" title="Edit"><i class="bi bi-pencil-square"></i></button>
                                                <button class="pd-mini-ic danger" @click="deleteDetailRow(i)" title="Hapus"><i class="bi bi-trash"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="pd-card">
                                    <div class="pd-card-head">
                                        <h4><i class="bi bi-file-earmark-text text-brand-600"></i> Berita Acara Pendukung</h4>
                                        <button class="btn-primary !py-1.5 !px-3 text-xs" @click="openKelolaBaPendukung(detail.p['ID Pengajuan'])"><i class="bi bi-gear"></i> Kelola BA Pendukung</button>
                                    </div>
                                    <div class="pd-card-body">
                                        <p class="text-xs text-slate-400">Kelola peserta dan berkas BA Pendukung untuk kegiatan pengajuan ini. Tiap peserta wajib memiliki berkas.</p>
                                    </div>
                                </div>
                            </template>

                            <!-- STEP 1: BERKAS -->
                            <template v-else-if="detail.step===1">
                                <div class="pd-progress">
                                    <span class="t">Kelengkapan berkas</span>
                                    <div class="track"><div class="fill" :style="{ width: (berkasProgress / 3 * 100) + '%' }"></div></div>
                                    <span class="num">{{ berkasProgress }}/3</span>
                                </div>

                                <div class="pd-doc-row">
                                    <div class="pd-doc-ic surat"><i class="bi bi-file-earmark-text"></i></div>
                                    <div class="pd-doc-info"><div class="t">Surat Keterangan</div><div class="s">Diunggah mahasiswa atau saat input manual</div></div>
                                    <div class="flex items-center gap-2">
                                        <span v-if="detail.p['Link Surat Keterangan']" class="pd-pill-ok"><i class="bi bi-check-circle-fill"></i>Ada</span>
                                        <span v-else class="pd-pill-no"><i class="bi bi-dash-circle"></i>Belum</span>
                                        <a v-if="detail.p['Link Surat Keterangan']" :href="safeUrl(detail.p['Link Surat Keterangan'])" target="_blank" rel="noopener noreferrer" class="btn-soft !px-2 !py-1 text-xs" title="Lihat Surat Keterangan"><i class="bi bi-box-arrow-up-right"></i></a>
                                    </div>
                                </div>
                                <div v-if="!detail.p['Link Surat Keterangan']" class="pd-card" style="margin-top:2px;background:#fcfcfe">
                                    <div class="pd-card-body">
                                        <div class="pd-upzone">
                                            <i class="bi bi-cloud-arrow-up lead"></i>
                                            <div><span v-if="!detail.suratFile">Pilih berkas surat keterangan (PDF/JPG/PNG)</span><span v-else class="font-semibold text-slate-700">{{ detail.suratName }}</span></div>
                                            <div class="hint">PDF / JPG / PNG — maksimal 5 MB</div>
                                            <div class="row">
                                                <label class="btn-soft cursor-pointer"><i class="bi bi-folder2-open"></i> Pilih File<input type="file" accept=".pdf,.jpg,.jpeg,.png" class="hidden" @change="onSuratFile"></label>
                                                <button type="button" class="btn-primary" :disabled="!detail.suratFile || detail.suratUploading" @click="uploadSurat">{{ detail.suratUploading ? 'Mengunggah...' : 'Simpan Berkas' }}</button>
                                            </div>
                                        </div>
                                        <p v-if="detail.suratError" class="mt-2 text-xs font-semibold text-rose-600">{{ detail.suratError }}</p>
                                    </div>
                                </div>

                                <div class="pd-doc-row">
                                    <div class="pd-doc-ic acc"><i class="bi bi-patch-check"></i></div>
                                    <div class="pd-doc-info"><div class="t">ACC INHAL</div><div class="s">Dihasilkan sistem — tidak dapat diganti manual</div></div>
                                    <div class="flex items-center gap-2">
                                        <span v-if="detail.p['Link ACC INHAL']" class="pd-pill-ok"><i class="bi bi-check-circle-fill"></i>Ada</span>
                                        <span v-else class="pd-pill-no"><i class="bi bi-dash-circle"></i>Belum</span>
                                        <a v-if="detail.p['Link ACC INHAL']" :href="safeUrl(detail.p['Link ACC INHAL'])" target="_blank" rel="noopener noreferrer" class="btn-soft !px-2 !py-1 text-xs" title="Lihat ACC INHAL"><i class="bi bi-box-arrow-up-right"></i></a>
                                    </div>
                                </div>

                                <div class="pd-doc-row">
                                    <div class="pd-doc-ic bukti"><i class="bi bi-cash-coin"></i></div>
                                    <div class="pd-doc-info"><div class="t">Bukti Bayar</div><div class="s">Unggah oleh admin bila mahasiswa belum melampirkan</div></div>
                                    <div class="flex items-center gap-2">
                                        <span v-if="detail.p['Link Bukti Bayar']" class="pd-pill-ok"><i class="bi bi-check-circle-fill"></i>Ada</span>
                                        <span v-else class="pd-pill-no"><i class="bi bi-dash-circle"></i>Belum</span>
                                        <a v-if="detail.p['Link Bukti Bayar']" :href="safeUrl(detail.p['Link Bukti Bayar'])" target="_blank" rel="noopener noreferrer" class="btn-soft !px-2 !py-1 text-xs" title="Lihat Bukti Bayar"><i class="bi bi-box-arrow-up-right"></i></a>
                                    </div>
                                </div>
                                <div class="pd-card" style="margin-top:2px;background:#fcfcfe">
                                    <div class="pd-card-head"><h4><i class="bi bi-cloud-arrow-up text-brand-600"></i> Unggah Bukti Bayar (oleh Admin)</h4></div>
                                    <div class="pd-card-body">
                                        <div class="pd-upzone">
                                            <i class="bi bi-cloud-arrow-up lead"></i>
                                            <div><span v-if="!detail.buktiFile">Pilih berkas bukti bayar atau scan kamera...</span><span v-else class="font-semibold text-slate-700">{{ detail.buktiFile.name }}</span></div>
                                            <div class="hint">PDF / JPG / PNG — maksimal 5 MB</div>
                                            <div class="row">
                                                <label class="btn-soft cursor-pointer"><i class="bi bi-folder2-open"></i> Pilih File<input type="file" accept=".pdf,.jpg,.jpeg,.png" class="hidden" @change="onBuktiFile($event)"></label>
                                                <button type="button" class="btn-soft" :disabled="detail.scanBusy" @click="$refs.buktiCamera.click()"><i class="bi bi-camera"></i> Scan Kamera</button>
                                                <button type="button" class="btn-primary" :disabled="detail.buktiUploading" @click="uploadBuktiBayar()">{{ detail.buktiUploading ? 'Mengunggah...' : 'Simpan Berkas' }}</button>
                                            </div>
                                        </div>
                                        <div v-if="detail.scanItems.length" class="mt-2 flex flex-wrap items-center gap-2">
                                            <span class="text-xs text-slate-500">{{ detail.scanItems.length }} halaman</span>
                                            <button type="button" class="btn-primary !py-1.5 text-xs" :disabled="detail.scanBusy" @click="scanBuildPdf('bukti')"><i class="bi bi-file-earmark-pdf"></i> Buat PDF</button>
                                            <button type="button" class="btn-soft !py-1.5 text-xs" @click="scanClear('bukti')">Bersihkan</button>
                                        </div>
                                        <div v-if="detail.scanItems.length" class="pd-scan-grid">
                                            <div v-for="(it, idx) in detail.scanItems" :key="it.id" class="pd-scan-item">
                                                <img :src="it.url" :alt="'Halaman ' + (idx + 1)" class="h-20 w-full object-cover">
                                                <span class="absolute left-1 top-1 rounded bg-slate-900/70 px-1.5 text-[10px] font-semibold text-white">{{ idx + 1 }}</span>
                                                <button type="button" class="absolute right-1 top-1 rounded bg-rose-600/90 px-1.5 text-[10px] font-bold text-white" @click="scanRemove(idx, 'bukti')">x</button>
                                                <div class="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-slate-900/60 py-0.5">
                                                    <button type="button" class="rounded px-1 text-[11px] text-white disabled:opacity-30" :disabled="idx === 0" title="Geser ke kiri" @click="scanMove(idx, -1, 'bukti')"><i class="bi bi-arrow-left"></i></button>
                                                    <button type="button" class="rounded px-1 text-[11px] text-white disabled:opacity-30" :disabled="idx === detail.scanItems.length - 1" title="Geser ke kanan" @click="scanMove(idx, 1, 'bukti')"><i class="bi bi-arrow-right"></i></button>
                                                </div>
                                            </div>
                                        </div>
                                        <p v-if="detail.scanBusy" class="mt-2 text-xs text-brand-600">Memproses gambar...</p>
                                        <p v-if="detail.buktiError" class="mt-2 text-xs text-rose-500">{{ detail.buktiError }}</p>
                                        <input ref="buktiCamera" type="file" accept="image/*" capture="environment" multiple class="hidden" @change="scanOnPhotos($event, 'bukti')">
                                    </div>
                                </div>
                            </template>

                            <!-- STEP 2: KEPUTUSAN -->
                            <template v-else>
                                <div v-if="isManual(detail.p)" class="pd-manual-note"><i class="bi bi-info-circle"></i> Pengajuan manual — notifikasi email dinonaktifkan.</div>

                                <div class="pd-card">
                                    <div class="pd-card-head"><h4><i class="bi bi-check2-circle text-brand-600"></i> Perbarui Status</h4></div>
                                    <div class="pd-card-body">
                                        <div class="pd-statuspick">
                                            <button type="button" data-s="Menunggu" :class="{ on: detail.status==='Menunggu' }" @click="detail.status='Menunggu'"><div class="ic"><i class="bi bi-hourglass-split"></i></div><div><div class="t">Menunggu</div><div class="s">tahan untuk ditinjau ulang</div></div></button>
                                            <button type="button" data-s="ACC" :class="{ on: detail.status==='ACC' }" @click="detail.status='ACC'"><div class="ic"><i class="bi bi-patch-check"></i></div><div><div class="t">Jadikan ACC</div><div class="s">berkas dinyatakan lengkap</div></div></button>
                                            <button type="button" data-s="Ditolak" :class="{ on: detail.status==='Ditolak' }" @click="detail.status='Ditolak'"><div class="ic"><i class="bi bi-x-lg"></i></div><div><div class="t">Tolak</div><div class="s">perlu catatan alasan</div></div></button>
                                            <button type="button" data-s="Dibatalkan" :class="{ on: detail.status==='Dibatalkan' }" @click="detail.status='Dibatalkan'"><div class="ic"><i class="bi bi-slash-circle"></i></div><div><div class="t">Batalkan</div><div class="s">oleh admin/mahasiswa</div></div></button>
                                        </div>
                                        <div class="mt-4">
                                            <label class="label">Catatan <span class="text-rose-400" v-if="detail.status==='Ditolak' || detail.status==='Dibatalkan'">(wajib)</span></label>
                                            <textarea v-model="detail.catatan" class="input" rows="3" placeholder="Catatan keputusan..."></textarea>
                                        </div>
                                        <div class="mt-3 flex flex-wrap gap-2">
                                            <button class="btn-primary" @click="updateStatus()"><i class="bi bi-check2-circle"></i>Perbarui Status</button>
                                            <button class="btn-soft" @click="quickStatus('ACC')"><i class="bi bi-patch-check"></i>Jadikan ACC</button>
                                            <button class="btn-soft" @click="quickStatus('Ditolak')"><i class="bi bi-hand-thumbs-down"></i>Tolak</button>
                                        </div>
                                    </div>
                                </div>

                                <div class="pd-card">
                                    <div class="pd-card-head"><h4><i class="bi bi-envelope-check text-brand-600"></i> Email ACC Final</h4></div>
                                    <div class="pd-card-body">
                                        <div class="flex flex-wrap gap-2">
                                            <button v-if="!isManual(detail.p) && detail.p.Status==='ACC'" class="btn-soft" @click="sendFinalEmail()"><i class="bi bi-envelope-paper"></i>Kirim Ulang Email ACC Final</button>
                                            <button v-if="detail.p.Status==='ACC'" class="btn-soft" @click="sendAccFinalToBagian()"><i class="bi bi-send"></i>Kirim Ulang Khusus ke Bagian</button>
                                            <span v-if="isManual(detail.p)" class="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 ring-1 ring-inset ring-violet-200"><i class="bi bi-info-circle"></i>Pengajuan manual tanpa email — notifikasi email dinonaktifkan.</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="pd-card" style="border-color:#fecdd3">
                                    <div class="pd-card-body flex items-center justify-between gap-2.5">
                                        <div>
                                            <div class="text-[13px] font-bold text-slate-900">Hapus pengajuan</div>
                                            <div class="text-[11px] text-slate-400">Tindakan ini tidak dapat dibatalkan.</div>
                                        </div>
                                        <button class="btn-danger-soft" @click="deletePengajuan()"><i class="bi bi-trash"></i> Hapus</button>
                                    </div>
                                </div>
                            </template>
                        </template>
                    </div>

                    <div class="pd-foot">
                        <template v-if="detail.step===0">
                            <button class="btn-soft" @click="detail.open=false">Tutup</button>
                            <div class="spacer"></div>
                            <button class="btn-primary" @click="setDetailStep(1)">Lanjut ke Berkas <i class="bi bi-arrow-right"></i></button>
                        </template>
                        <template v-else-if="detail.step===1">
                            <button class="btn-soft" @click="setDetailStep(0)"><i class="bi bi-arrow-left"></i> Kembali</button>
                            <div class="spacer"></div>
                            <button class="btn-primary" @click="setDetailStep(2)">Lanjut ke Keputusan <i class="bi bi-arrow-right"></i></button>
                        </template>
                        <template v-else>
                            <button class="btn-soft" @click="setDetailStep(1)"><i class="bi bi-arrow-left"></i> Kembali</button>
                            <div class="spacer"></div>
                            <button class="btn-primary" @click="updateStatus()"><i class="bi bi-check2-circle"></i> Perbarui Status</button>
                        </template>
                    </div>
                </aside>
            </div>
        </transition>
```

- [ ] **Step 5: Sesuaikan dua asersi lama**

Edit `new-code1-cf/test/dashboard-template.test.js`.

(a) Ganti:
```javascript
  it('menyediakan opsi ACC pada dropdown status', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('<option>ACC</option>');
  });
```
Menjadi:
```javascript
  it('menyediakan pemilih status ACC pada panel keputusan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('class="pd-statuspick"');
    expect(html).toContain('data-s="ACC"');
  });
```

(b) Ganti dalam `describe('guard alur status dashboard', ...)`:
```javascript
    expect(html).toContain('<option>Menunggu</option>');
```
Menjadi:
```javascript
    expect(html).toContain('data-s="Menunggu"');
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: PASS seluruh file (termasuk tes kompilasi Vue).

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "feat(dashboard): ganti modal detail dengan drawer berstepper 3 langkah"
```

---

### Task 3: Guard regresi (reset step + kelengkapan berkas) dan verifikasi suite penuh

**Files:**
- Test: `new-code1-cf/test/dashboard-template.test.js`
- Verify only: `new-code1-cf/public/dashboard.html` (tidak diubah kecuali ada bug)

**Interfaces:**
- Consumes: `setDetailStep(n)`, `detail.step`, `berkasProgress()` dari Task 1-2.
- Produces: test penjaga regresi; tidak ada API baru.

- [ ] **Step 1: Write the failing test**

Tambahkan `it` berikut ke dalam `describe('dashboard detail drawer', ...)` di `new-code1-cf/test/dashboard-template.test.js`:

```javascript
  it('mereset langkah drawer ke 0 dan menyediakan progres berkas', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('this.detail.step = 0;');
    expect(html).toContain('berkasProgress() {');
    expect(html).toContain("p['Link Surat Keterangan'], p['Link ACC INHAL'], p['Link Bukti Bayar']");
    expect(html).toContain(':style="{ width: (berkasProgress / 3 * 100) + \'%\' }"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "mereset langkah drawer"`
Expected: PASS (Task 1-2 sudah mengimplementasikan ini). Jika FAIL, periksa string persisnya dan perbaiki markup — jangan ubah ekspektasi.

> Catatan: test ini adalah guard; karena implementasinya sudah ada, langkah ini boleh langsung hijau. Jika hijau, lanjut Step 3.

- [ ] **Step 3: Run seluruh suite**

Run: `cd new-code1-cf && npm test`
Expected: seluruh file lulus (jumlah tes lama + tes baru), 0 gagal.

- [ ] **Step 4: Verifikasi preview (opsional, manual)**

Jalankan dev server sesuai skill `deploy-website`, buka `/dashboard`, dan pastikan: drawer muncul dari kanan saat klik Detail; stepper berpindah 3 langkah; di lebar < 768px drawer menjadi bottom-sheet; tombol Kebijakan/Berkas/Keputusan berfungsi; unggah bukti bayar + scan kamera berfungsi; Kelola BA Pendukung terbuka di atas drawer. Jika ada bug, perbaiki `dashboard.html` dan ulangi Step 3.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/test/dashboard-template.test.js
git commit -m "test(dashboard): guard reset stepper dan progres berkas drawer"
```

---

## Self-Review

**1. Spec coverage:**
- Drawer kanan 600px + overlay + bottom-sheet mobile → Task 1 CSS.
- Stepper 3 langkah (Identitas/Berkas/Keputusan) → Task 1 `setDetailStep`, Task 2 markup `data-step`.
- Step Identitas: Data Mahasiswa (view/edit), Detail Kegiatan (edit/hapus), Kelola BA Pendukung → Task 2 step 0.
- Step Berkas: progress x/3, 3 doc row, unggah surat, unggah+scan bukti, ACC read-only → Task 2 step 1 + Task 2 `berkasProgress`.
- Step Keputusan: catatan manual, statuspick 4 status (tanpa Diterima), catatan, updateStatus/quickStatus, email ACC final, hapus → Task 2 step 2.
- Footer navigasi per langkah → Task 2 `.pd-foot`.
- Semua method/field produksi dipertahankan → Task 2 test "mempertahankan kemampuan produksi".
- Tidak ada `Diterima` → Task 2 test + guard lama.
- Responsif → Task 1 media query.

**2. Placeholder scan:** Tidak ada TODO/TBD; setiap langkah memuat kode/commmand persis.

**3. Type consistency:** `setDetailStep(n)` (Task 1) dipakai di Task 2 markup & Task 3 test; `detail.step` konsisten; `berkasProgress` (computed no-arg) didefinisikan Task 2 dan dipakai di markup+test dengan string persis sama; kelas `pd-*` Task 1 = markup Task 2.
