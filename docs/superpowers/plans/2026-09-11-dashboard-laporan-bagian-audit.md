# Laporan Bagian Audit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rancang ulang tab "Laporan Bagian" di `new-code1-cf/public/dashboard.html` menjadi audit kelengkapan BA per kegiatan: ringkasan mengikuti filter, peta kelengkapan, dan tabel audit informatif dengan pembeda sumber BA (Bagian vs Admin) dan ekspor Excel.

**Architecture:** Perluas `getBagianAggregation` (`src/read/dashboard.js`) agar mengembalikan `summary`, `units[]`, `orphanBa[]`, dan `filters`, dengan penggabungan dua tabel BA dan pencocokan via NPM peserta (fallback normalisasi teks). Frontend menghitung filter/sort/agregat di sisi klien dari `bagian.units` dan mengganti template tab.

**Tech Stack:** Cloudflare Workers + D1, vitest (`@cloudflare/vitest-pool-workers`), Vue 3 global (CDN), SheetJS (CDN), CSS utilitas inline di `dashboard.html`.

## Global Constraints

- Tidak ada perubahan skema DB.
- Backend berubah hanya `src/read/dashboard.js` (dan test baru). Frontend berubah hanya `new-code1-cf/public/dashboard.html`.
- Jangan menambah komentar kode tanpa diminta.
- Jalankan `npx vitest run` dari `new-code1-cf/`.
- Sumber BA: `berita_acara`+`berita_acara_peserta` = `Bagian`; `berita_acara_admin`+`berita_acara_admin_peserta` = `Admin`.
- Pencocokan mengabaikan tanggal; unit = `bagian + blok + kegiatan`.
- Commit trailer: `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
- Spec acuan: `docs/superpowers/specs/2026-09-11-dashboard-laporan-bagian-audit-design.md`.

---

### Task 1: Backend `getBagianAggregation` mengembalikan units/summary/orphanBa

**Files:**
- Modify: `new-code1-cf/src/read/dashboard.js:149-197`
- Test: `new-code1-cf/test/read-bagian-audit.test.js` (create)

**Interfaces:**
- Produces: `getBagianAggregation(db, ctx) -> Promise<{ categories: string[], labs: string[], filters: { bagian: string[], blok: string[], sumber: ['Bagian','Admin'] }, summary: { totalKegiatan, totalPeserta, denganBa, denganBaBagian, denganBaAdmin, belumBa, finalAcc, persenLengkap }, units: Unit[], orphanBa: BaRecord[] }>`
- `Unit = { key, bagian, blok, pilihan, detail, label, tanggal, tanggalList: string[], peserta: {npm,namaLengkap,blok,statusPengajuan,idPengajuan}[], jumlahPeserta, pesertaDenganBa, ba: BaRecord[], linkFinal, statusBa: 'ada'|'belum', statusFinal: 'ada'|'belum' }`
- `BaRecord = { baId, sumber: 'Bagian'|'Admin', bagian, blok, namaKegiatan, tanggal, fileUrl, fileName, catatan, timestamp, peserta: {npm,namaLengkap,blok}[] }`

- [ ] **Step 1: Write the failing tests**

Create `new-code1-cf/test/read-bagian-audit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getBagianAggregation } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}
async function seedPengajuan() {
  await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('INHAL-1','2201010001','Aisyah','Blok A','SGD','Diterima','')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('INHAL-1','SGD','SGD 1','Remediasi','2026-09-20','')").run();
}
async function seedBa({ baId, bagian, blok, nama, tanggal, fileUrl, npm }) {
  await env.DB.prepare("INSERT INTO berita_acara (ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_url,catatan,sumber) VALUES (?1,?2,?3,?4,?5,'1',?6,'','Bagian')").bind(baId, bagian, blok, nama, tanggal, fileUrl).run();
  if (npm) await env.DB.prepare("INSERT INTO berita_acara_peserta (ba_id,npm,nama_lengkap,blok) VALUES (?1,?2,'Aisyah',?3)").bind(baId, npm, blok).run();
}
async function seedBaAdmin({ baId, bagian, blok, nama, tanggal, fileUrl, npm }) {
  await env.DB.prepare("INSERT INTO berita_acara_admin (ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_url,catatan,sumber) VALUES (?1,?2,?3,?4,?5,'1',?6,'','Admin')").bind(baId, bagian, blok, nama, tanggal, fileUrl).run();
  if (npm) await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (ba_id,npm,nama_lengkap,blok) VALUES (?1,?2,'Aisyah',?3)").bind(baId, npm, blok).run();
}

describe('getBagianAggregation audit', () => {
  it('requires an admin session', async () => {
    await expect(getBagianAggregation(env.DB, {})).rejects.toThrow();
  });

  it('matches BA to a unit via peserta NPM', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-1', bagian: 'SGD', blok: 'Blok A', nama: 'SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/1', npm: '2201010001' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units).toHaveLength(1);
    expect(data.units[0].statusBa).toBe('ada');
    expect(data.units[0].pesertaDenganBa).toBe(1);
    expect(data.summary).toMatchObject({ totalKegiatan: 1, denganBa: 1, denganBaBagian: 1, denganBaAdmin: 0, belumBa: 0 });
    expect(data.summary.persenLengkap).toBe(100);
  });

  it('falls back to normalized text when BA has no peserta (em-dash vs hyphen)', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-2', bagian: 'SGD', blok: 'Blok A', nama: 'SGD \u2014 SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/2', npm: '' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units[0].statusBa).toBe('ada');
  });

  it('surfaces orphan BA without affecting totalKegiatan', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-3', bagian: 'KKD', blok: 'Blok Z', nama: 'KKD 9', tanggal: '2026-09-21', fileUrl: 'http://f/3', npm: '9999' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units).toHaveLength(1);
    expect(data.summary.totalKegiatan).toBe(1);
    expect(data.summary.belumBa).toBe(1);
    expect(data.orphanBa).toHaveLength(1);
    expect(data.orphanBa[0].baId).toBe('BA-3');
  });

  it('counts Bagian and Admin sources separately for the same unit', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-4', bagian: 'SGD', blok: 'Blok A', nama: 'SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/4', npm: '2201010001' });
    await seedBaAdmin({ baId: 'BA-5', bagian: 'SGD', blok: 'Blok A', nama: 'SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/5', npm: '2201010001' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units[0].ba).toHaveLength(2);
    expect(data.summary).toMatchObject({ denganBa: 1, denganBaBagian: 1, denganBaAdmin: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd new-code1-cf && npx vitest run test/read-bagian-audit.test.js`
Expected: FAIL (units/summary/orphanBa undefined atau assertion gagal).

- [ ] **Step 3: Replace `getBagianAggregation` implementation**

Replace `src/read/dashboard.js:149-197` with:

```js
export async function getBagianAggregation(db, ctx) {
  await requireAdmin(db, ctx.token);
  const all = async (table) => (await db.prepare(`SELECT * FROM ${table}`).all()).results || [];
  const pengajuan = await all('pengajuan');
  const details = await all('detail_kegiatan');
  const labs = await getMasterOptions(db, 'Lab');

  const pMap = {};
  for (const p of pengajuan) pMap[String(p.id_pengajuan || '').trim()] = toClientRow('pengajuan', p);

  const units = [];
  const unitIndex = {};
  const addPeserta = (unit, row) => {
    const dup = unit.peserta.some((x) =>
      (row.npm && x.npm === row.npm) || (!row.npm && row.idPengajuan && x.idPengajuan === row.idPengajuan));
    if (!dup) unit.peserta.push(row);
  };

  for (const d of details) {
    const row = toClientRow('detail_kegiatan', d);
    const idp = String(row['ID Pengajuan'] || '').trim();
    const p = pMap[idp] || {};
    const bagian = resolveBagian12(row['Jenis Kegiatan'] || row.Bagian, row.Pilihan || row.Bagian, '', labs) || 'Lainnya';
    const blok = String(p.Blok || row.Bagian || '').replace(/\s+/g, ' ').trim() || '-';
    const pilihan = String(row.Pilihan || '').trim();
    const detailText = String(row.Detail || '').trim();
    const label = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
    const key = [norm(bagian), blok.toLowerCase(), norm(label)].join('|');
    if (unitIndex[key] === undefined) {
      unitIndex[key] = units.length;
      units.push({ key, bagian, blok, pilihan, detail: detailText, label, tanggal: '', tanggalList: [], peserta: [], ba: [], linkFinal: '' });
    }
    const unit = units[unitIndex[key]];
    addPeserta(unit, {
      npm: String(p.NPM || '').trim(),
      namaLengkap: String(p['Nama Lengkap'] || '').trim(),
      blok: String(p.Blok || '').trim(),
      statusPengajuan: String(p.Status || '').trim(),
      idPengajuan: idp
    });
    const tgl = String(row['Tanggal Pelaksanaan'] || '').trim();
    if (tgl && unit.tanggalList.indexOf(tgl) === -1) unit.tanggalList.push(tgl);
    const lf = String(p['Link Final'] || '').trim();
    if (lf && !unit.linkFinal) unit.linkFinal = lf;
  }

  const normKegiatanText = (v) => norm(String(v || '').replace(/[\u2014\u2013]/g, '-'));

  async function collectBa(table, pesertaTable, sumber) {
    const rows = await all(table);
    const ps = await all(pesertaTable);
    const byId = {};
    const out = [];
    for (const r of rows) {
      const c = toClientRow(table, r);
      const baId = String(c['BA ID'] || '').trim();
      const rec = {
        baId, sumber,
        bagian: String(c.Bagian || '').trim(),
        blok: String(c.Blok || '').replace(/\s+/g, ' ').trim(),
        namaKegiatan: String(c['Nama Kegiatan'] || '').replace(/\s+/g, ' ').trim(),
        tanggal: String(c['Tanggal Pelaksanaan'] || '').trim(),
        fileUrl: String(c['File URL'] || '').trim(),
        fileName: String(c['File Name'] || '').trim(),
        catatan: String(c.Catatan || '').trim(),
        timestamp: String(c.Timestamp || '').trim(),
        peserta: []
      };
      byId[baId] = rec;
      out.push(rec);
    }
    for (const p of ps) {
      const baId = String(p.ba_id || '').trim();
      if (byId[baId]) byId[baId].peserta.push({
        npm: String(p.npm || '').trim(),
        namaLengkap: String(p.nama_lengkap || '').trim(),
        blok: String(p.blok || '').trim()
      });
    }
    return out;
  }

  const seenBa = new Set();
  const baList = [];
  for (const b of [].concat(
    await collectBa('berita_acara', 'berita_acara_peserta', 'Bagian'),
    await collectBa('berita_acara_admin', 'berita_acara_admin_peserta', 'Admin')
  )) {
    const dk = [norm(b.bagian), b.blok.toLowerCase(), normKegiatanText(b.namaKegiatan), b.tanggal, b.fileUrl].join('|');
    if (seenBa.has(dk)) continue;
    seenBa.add(dk);
    baList.push(b);
  }

  const bagKey = (bagian, blok) => norm(bagian) + '|' + String(blok || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const unitByBag = {};
  for (const u of units) {
    const k = bagKey(u.bagian, u.blok);
    (unitByBag[k] = unitByBag[k] || []).push(u);
  }

  const orphanBa = [];
  for (const b of baList) {
    const bBagian = resolveBagian12(b.bagian, '', b.namaKegiatan, labs) || b.bagian;
    const candidates = unitByBag[bagKey(bBagian, b.blok)] || [];
    const bNpms = b.peserta.map((p) => p.npm).filter(Boolean);
    let matched = candidates.filter((u) => u.peserta.some((p) => p.npm && bNpms.indexOf(p.npm) !== -1));
    if (!matched.length) {
      const bName = normKegiatanText(b.namaKegiatan);
      matched = candidates.filter((u) => {
        const l = normKegiatanText(u.label);
        return !!l && (bName === l || bName.endsWith(l));
      });
    }
    if (!matched.length) { orphanBa.push(b); continue; }
    for (const u of matched) u.ba.push(b);
  }

  const npmSet = new Set();
  for (const u of units) {
    const covered = new Set();
    for (const b of u.ba) for (const p of b.peserta) if (p.npm) covered.add(p.npm);
    u.pesertaDenganBa = u.peserta.filter((p) => p.npm && covered.has(p.npm)).length;
    u.jumlahPeserta = u.peserta.length;
    u.statusBa = u.ba.length ? 'ada' : 'belum';
    u.statusFinal = u.linkFinal ? 'ada' : 'belum';
    u.tanggalList = u.tanggalList.slice().sort();
    u.tanggal = u.tanggalList[0] || '';
    for (const p of u.peserta) if (p.npm) npmSet.add(p.npm);
  }

  const blokSet = [];
  for (const u of units) pushUnique(blokSet, u.blok);

  const summary = {
    totalKegiatan: units.length,
    totalPeserta: npmSet.size,
    denganBa: units.filter((u) => u.ba.length).length,
    denganBaBagian: units.filter((u) => u.ba.some((b) => b.sumber === 'Bagian')).length,
    denganBaAdmin: units.filter((u) => u.ba.some((b) => b.sumber === 'Admin')).length,
    belumBa: units.filter((u) => !u.ba.length).length,
    finalAcc: units.filter((u) => u.linkFinal).length
  };
  summary.persenLengkap = summary.totalKegiatan ? Math.round((summary.denganBa / summary.totalKegiatan) * 100) : 0;

  return {
    categories: getBagianOptions12(labs),
    labs,
    filters: { bagian: getBagianOptions12(labs), blok: blokSet.sort(), sumber: ['Bagian', 'Admin'] },
    summary,
    units,
    orphanBa
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd new-code1-cf && npx vitest run test/read-bagian-audit.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Run full suite to check regressions**

Run: `cd new-code1-cf && npx vitest run`
Expected: semua test lulus.

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add new-code1-cf/src/read/dashboard.js new-code1-cf/test/read-bagian-audit.test.js
git commit -m "feat(new-code1-cf): audit-shaped Laporan Bagian aggregation

- merge BA from berita_acara + berita_acara_admin
- match BA to kegiatan via peserta NPM, fallback normalized text
- return summary, units, orphanBa, filters

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 2: Frontend state, computed, dan method tab Laporan Bagian

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (state `bagian` di `:1422`, computed `bagianBlokOptions`/`bagianMatrixCols`/`bagianMatrix`/`bagianCellDetail` di `:1588-1668`, methods `normBagian`/`applyBagianFilter`/`openBagianCell`/`closeBagianDetail`/`matrixCellClass` di `:2645-2664`, `loadBagian()` di `:2111-2126`)

**Interfaces:**
- Consumes: `getBagianAggregation` return shape dari Task 1.
- Produces: `bagian.units`, `bagian.summary`, `bagian.orphanBa`, computed `bagianTableRows`, `bagianSummary`, `bagianBar`, `bagianHeatmap`, methods `resetBagianFilter`, `sortBagian`, `toggleBagianExpand`, `openBagianFromBar`, `openBagianFromCell`, `exportBagianExcel`.

- [ ] **Step 1: Ganti state `bagian`**

Di `dashboard.html:1422` ganti objek `bagian` menjadi:

```js
bagian: { units: [], orphanBa: [], fBagian: '', fBlok: '', fSumber: '', fStatusBa: '', fStatusFinal: '', q: '', onlyIncomplete: false, sortKey: 'tanggal', sortDir: 'desc', expanded: {}, options: [], labs: [], bloks: [] },
```

- [ ] **Step 2: Ganti computed bagian (hapus matriks lama, pertahankan `bagianBlokOptions`)**

Ganti `bagianMatrixCols`, `bagianMatrix`, `bagianCellDetail` (biarkan `bagianBlokOptions` yang memetakan `this.bagian.bloks`) dengan computed berikut:

```js
bagianSummary() {
    const units = this.bagianFilteredUnits;
    const npm = new Set();
    units.forEach(u => (u.peserta || []).forEach(p => { if (p.npm) npm.add(p.npm); }));
    const denganBa = units.filter(u => (u.ba || []).length).length;
    const total = units.length;
    return {
        totalKegiatan: total,
        totalPeserta: npm.size,
        denganBa,
        denganBaBagian: units.filter(u => (u.ba || []).some(b => b.sumber === 'Bagian')).length,
        denganBaAdmin: units.filter(u => (u.ba || []).some(b => b.sumber === 'Admin')).length,
        belumBa: total - denganBa,
        finalAcc: units.filter(u => u.linkFinal).length,
        persenLengkap: total ? Math.round((denganBa / total) * 100) : 0
    };
},
bagianFilteredUnits() {
    const q = String(this.bagian.q || '').trim().toLowerCase();
    let units = this.bagian.units || [];
    if (this.bagian.fBagian) units = units.filter(u => u.bagian === this.bagian.fBagian);
    if (this.bagian.fBlok) units = units.filter(u => u.blok === this.bagian.fBlok);
    if (this.bagian.fSumber) units = units.filter(u => (u.ba || []).some(b => b.sumber === this.bagian.fSumber));
    if (this.bagian.fStatusBa) units = units.filter(u => u.statusBa === this.bagian.fStatusBa);
    if (this.bagian.fStatusFinal) units = units.filter(u => u.statusFinal === this.bagian.fStatusFinal);
    if (this.bagian.onlyIncomplete) units = units.filter(u => u.statusBa !== 'ada');
    if (q) {
        units = units.filter(u => {
            const hay = [u.bagian, u.blok, u.label, u.linkFinal, (u.ba || []).map(b => b.baId).join(' '),
                (u.peserta || []).map(p => p.npm + ' ' + p.namaLengkap).join(' ')].join(' ').toLowerCase();
            return hay.indexOf(q) !== -1;
        });
    }
    return units;
},
bagianSortedUnits() {
    const units = this.bagianFilteredUnits.slice();
    const key = this.bagian.sortKey;
    const dir = this.bagian.sortDir === 'asc' ? 1 : -1;
    const val = (u) => {
        if (key === 'bagian') return u.bagian;
        if (key === 'blok') return u.blok;
        if (key === 'kegiatan') return u.label;
        if (key === 'peserta') return Number(u.jumlahPeserta) || 0;
        if (key === 'ba') return u.statusBa === 'ada' ? 1 : 0;
        if (key === 'final') return u.statusFinal === 'ada' ? 1 : 0;
        return u.tanggal || '';
    };
    return units.sort((a, b) => {
        const va = val(a), vb = val(b);
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
    });
},
bagianOrphanFiltered() {
    if (this.bagian.onlyIncomplete) return [];
    const q = String(this.bagian.q || '').trim().toLowerCase();
    return (this.bagian.orphanBa || []).filter(b => {
        if (this.bagian.fBagian && b.bagian !== this.bagian.fBagian) return false;
        if (this.bagian.fBlok && b.blok !== this.bagian.fBlok) return false;
        if (this.bagian.fSumber && b.sumber !== this.bagian.fSumber) return false;
        if (q) {
            const hay = [b.bagian, b.blok, b.namaKegiatan, b.baId, (b.peserta || []).map(p => p.npm + ' ' + p.namaLengkap).join(' ')].join(' ').toLowerCase();
            if (hay.indexOf(q) === -1) return false;
        }
        return true;
    });
},
bagianTableRows() {
    const units = this.bagianSortedUnits.map(u => Object.assign({ __orphan: false }, u));
    const orphans = this.bagianOrphanFiltered.map(b => ({
        __orphan: true, key: 'orphan-' + b.sumber + '-' + b.baId, bagian: b.bagian, blok: b.blok,
        label: b.namaKegiatan, tanggal: b.tanggal, tanggalList: [b.tanggal], peserta: b.peserta,
        jumlahPeserta: (b.peserta || []).length, statusBa: 'ada', statusFinal: 'belum',
        linkFinal: '', ba: [b]
    }));
    return units.concat(orphans);
},
bagianBar() {
    const map = {};
    (this.bagianFilteredUnits || []).forEach(u => {
        if (!map[u.bagian]) map[u.bagian] = { bagian: u.bagian, total: 0, done: 0 };
        map[u.bagian].total += 1;
        if (u.statusBa === 'ada') map[u.bagian].done += 1;
    });
    return Object.values(map).map(g => Object.assign(g, { pct: g.total ? Math.round((g.done / g.total) * 100) : 0 }))
        .sort((a, b) => a.bagian.localeCompare(b.bagian));
},
bagianHeatmap() {
    const cols = [];
    (this.bagian.units || []).forEach(u => { if (u.blok && cols.indexOf(u.blok) === -1) cols.push(u.blok); });
    cols.sort();
    const bagSet = [];
    (this.bagian.units || []).forEach(u => { if (bagSet.indexOf(u.bagian) === -1) bagSet.push(u.bagian); });
    const rows = bagSet.map(bag => {
        const cells = {};
        cols.forEach(b => {
            const inCell = (this.bagianFilteredUnits || []).filter(u => u.bagian === bag && u.blok === b);
            cells[b] = { total: inCell.length, done: inCell.filter(u => u.statusBa === 'ada').length };
        });
        return { bagian: bag, cells };
    });
    return { cols, rows };
},
```

- [ ] **Step 3: Ganti method bagian**

Ganti `normBagian`... `matrixCellClass` (biarkan `normBagian` bila masih dipakai tempat lain; `resolveBaBagian` tetap). Hapus `applyBagianFilter`, `openBagianCell`, `closeBagianDetail`, `matrixCellClass`. Tambahkan:

```js
resetBagianFilter() {
    Object.assign(this.bagian, { fBagian: '', fBlok: '', fSumber: '', fStatusBa: '', fStatusFinal: '', q: '', onlyIncomplete: false });
},
sortBagian(key) {
    if (this.bagian.sortKey === key) {
        this.bagian.sortDir = this.bagian.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        this.bagian.sortKey = key;
        this.bagian.sortDir = 'asc';
    }
},
sortBagianIcon(key) {
    if (this.bagian.sortKey !== key) return 'bi-arrow-down-up opacity-40';
    return this.bagian.sortDir === 'asc' ? 'bi-sort-down-alt' : 'bi-sort-up-alt';
},
toggleBagianExpand(key) {
    this.bagian.expanded = Object.assign({}, this.bagian.expanded, { [key]: !this.bagian.expanded[key] });
},
openBagianFromBar(bagian) {
    this.bagian.fBagian = this.bagian.fBagian === bagian ? '' : bagian;
    this.bagian.fBlok = '';
},
openBagianFromCell(bagian, blok) {
    this.bagian.fBagian = bagian;
    this.bagian.fBlok = blok;
},
bagianStatusBaClass(status) {
    return status === 'ada' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
},
bagianStatusFinalClass(status) {
    return status === 'ada' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500';
},
exportBagianExcel() {
    if (!window.XLSX) { this.notify('Fungsi ekspor belum siap, muat ulang halaman.', false); return; }
    const rows = this.bagianTableRows.map(u => ({
        Tanggal: (u.tanggalList || [u.tanggal]).filter(Boolean).join(', '),
        Bagian: u.__orphan ? 'BA tanpa pengajuan' : u.bagian,
        Blok: u.blok,
        Kegiatan: u.label,
        'Jumlah Peserta': u.jumlahPeserta,
        'Status BA': u.statusBa === 'ada' ? 'Ada' : 'Belum',
        'Sumber BA': (u.ba || []).map(b => b.sumber).join(', '),
        'BA ID': (u.ba || []).map(b => b.baId).join(', '),
        'Link File BA': (u.ba || []).map(b => b.fileUrl).filter(Boolean).join(', '),
        'Status Final': u.statusFinal === 'ada' ? 'Ada' : 'Belum',
        'Link Final': u.linkFinal || ''
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows.length ? rows : [{ Tanggal: '', Bagian: '', Blok: '', Kegiatan: '', 'Jumlah Peserta': '' }]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Laporan Bagian');
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    window.XLSX.writeFile(wb, 'laporan-bagian-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.xlsx');
},
```

- [ ] **Step 4: Ganti `loadBagian()`**

Ganti isi `loadBagian()` (`:2111-2126`) menjadi:

```js
async loadBagian() {
    this.sectionLoading.bagian = true;
    try {
        const data = await this.run('getBagianAggregation') || {};
        this.bagian.units = data.units || [];
        this.bagian.orphanBa = data.orphanBa || [];
        this.bagian.labs = data.labs || this.bagian.labs;
        this.bagian.options = (data.filters && data.filters.bagian) || this.bagian.options;
        this.bagian.bloks = (data.filters && data.filters.blok) || [];
        this.loaded.bagian = true;
    } catch (e) {
        this.notify('Gagal memuat laporan bagian: ' + e, false);
    } finally {
        this.sectionLoading.bagian = false;
    }
},
```

- [ ] **Step 5: Verifikasi sintaks inline script**

Run:
```bash
cd /workspace/new-code1-cf && python3 - <<'PY'
import re
html = open('public/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/dashboard_inline.js
```
Expected: exit 0 tanpa output.

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add new-code1-cf/public/dashboard.html
git commit -m "refactor(new-code1-cf): rework Laporan Bagian frontend logic for audit table

- new bagian state, computed (summary/filter/sort/heatmap/orphan) and methods
- loadBagian consumes units/summary/orphanBa
- Excel export via SheetJS with date-stamped filename

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 3: Template tab Laporan Bagian (3 zona + mobile) dan CDN SheetJS

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` section `TAB: LAPORAN BAGIAN` (`:442-543`) dan tambah `<script>` CDN di dekat `:1374`.

**Interfaces:**
- Consumes: state/computed/method Task 2.

- [ ] **Step 1: Tambah script SheetJS**

Setelah baris `<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>` (`:1374`) tambahkan:

```html
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

- [ ] **Step 2: Ganti seluruh section `TAB: LAPORAN BAGIAN`**

Ganti `<section v-if="tab==='bagian'">...</section>` (`:442-543`) menjadi:

```html
<section v-if="tab==='bagian'">
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
            <h1 class="text-xl font-extrabold tracking-tight text-slate-900">Laporan Bagian</h1>
            <p class="mt-0.5 text-sm text-slate-500">Audit kelengkapan berita acara per kegiatan.</p>
        </div>
        <button class="btn-soft !py-2 text-xs" @click="exportBagianExcel"><i class="bi bi-file-earmark-excel"></i> Ekspor Excel</button>
    </div>

    <div v-if="sectionLoading.bagian" class="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-white py-12 text-slate-400 shadow-soft ring-1 ring-slate-100">
        <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span class="text-sm font-semibold">Memuat laporan bagian...</span>
    </div>

    <template v-else>
        <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kegiatan</div>
                <div class="mt-1 text-xl font-extrabold text-slate-900">{{ bagianSummary.totalKegiatan }}</div>
            </div>
            <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Peserta</div>
                <div class="mt-1 text-xl font-extrabold text-slate-900">{{ bagianSummary.totalPeserta }}</div>
            </div>
            <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Punya BA</div>
                <div class="mt-1 text-xl font-extrabold text-emerald-600">{{ bagianSummary.denganBa }}/{{ bagianSummary.totalKegiatan }}</div>
                <div class="text-[11px] font-semibold text-slate-400">{{ bagianSummary.persenLengkap }}%</div>
            </div>
            <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">BA Bagian</div>
                <div class="mt-1 text-xl font-extrabold text-brand-700">{{ bagianSummary.denganBaBagian }}</div>
            </div>
            <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">BA Admin</div>
                <div class="mt-1 text-xl font-extrabold text-indigo-600">{{ bagianSummary.denganBaAdmin }}</div>
            </div>
            <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Belum BA</div>
                <div class="mt-1 text-xl font-extrabold text-rose-600">{{ bagianSummary.belumBa }}</div>
            </div>
            <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ACC Final</div>
                <div class="mt-1 text-xl font-extrabold text-slate-900">{{ bagianSummary.finalAcc }}</div>
            </div>
        </div>

        <div class="mb-4 grid items-start gap-4 lg:grid-cols-2">
            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                <h2 class="mb-3 text-sm font-bold text-slate-900">Kelengkapan per Bagian</h2>
                <div v-if="!bagianBar.length" class="py-6 text-center text-sm text-slate-400">Belum ada data.</div>
                <div v-else class="space-y-2.5">
                    <button v-for="g in bagianBar" :key="g.bagian" class="w-full text-left" @click="openBagianFromBar(g.bagian)">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-semibold text-slate-700">{{ g.bagian }}</span>
                            <span class="text-slate-400">{{ g.done }}/{{ g.total }} · {{ g.pct }}%</span>
                        </div>
                        <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div class="h-full rounded-full" :class="g.pct === 100 ? 'bg-emerald-500' : (g.pct > 0 ? 'bg-amber-400' : 'bg-rose-400')" :style="{ width: g.pct + '%' }"></div>
                        </div>
                    </button>
                </div>
            </div>
            <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                <h2 class="border-b border-slate-100 p-4 text-sm font-bold text-slate-900">Peta Kelengkapan Bagian x Blok</h2>
                <div v-if="!bagianHeatmap.cols.length" class="px-4 py-8 text-center text-sm text-slate-400">Belum ada data.</div>
                <div v-else class="overflow-x-auto p-4">
                    <table class="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th class="p-2 text-left font-bold text-slate-400">Bagian</th>
                                <th v-for="b in bagianHeatmap.cols" :key="'hc' + b" class="p-2 text-center font-bold text-slate-500">{{ b }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in bagianHeatmap.rows" :key="'hr' + r.bagian">
                                <td class="p-2 font-semibold text-slate-700">{{ r.bagian }}</td>
                                <td v-for="b in bagianHeatmap.cols" :key="'h' + r.bagian + b" class="p-1 text-center">
                                    <button v-if="r.cells[b].total" class="w-full rounded-lg px-2 py-1.5 font-bold ring-1 ring-inset" :class="r.cells[b].done === r.cells[b].total ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : (r.cells[b].done > 0 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-rose-200')" @click="openBagianFromCell(r.bagian, b)">
                                        {{ r.cells[b].done }}/{{ r.cells[b].total }}
                                    </button>
                                    <span v-else class="text-slate-300">–</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="mb-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
            <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-4"><input v-model="bagian.q" class="input" placeholder="Cari kegiatan, BA ID, NPM, peserta..."></div>
                <div class="md:col-span-2"><select v-model="bagian.fBagian" class="input"><option value="">Semua Bagian</option><option v-for="o in bagian.options" :key="o" :value="o">{{ o }}</option></select></div>
                <div class="md:col-span-2"><select v-model="bagian.fBlok" class="input"><option value="">Semua Blok</option><option v-for="b in bagianBlokOptions" :key="b" :value="b">{{ b }}</option></select></div>
                <div class="md:col-span-2"><select v-model="bagian.fSumber" class="input"><option value="">Semua Sumber</option><option value="Bagian">BA Bagian</option><option value="Admin">BA Admin</option></select></div>
                <div class="md:col-span-2"><select v-model="bagian.fStatusBa" class="input"><option value="">Semua Status BA</option><option value="ada">BA Ada</option><option value="belum">BA Belum</option></select></div>
                <div class="md:col-span-2"><select v-model="bagian.fStatusFinal" class="input"><option value="">Semua Final</option><option value="ada">Final Ada</option><option value="belum">Final Belum</option></select></div>
                <div class="md:col-span-3 flex items-center gap-2">
                    <label class="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" v-model="bagian.onlyIncomplete" class="h-4 w-4 accent-brand-600"> Hanya belum lengkap</label>
                </div>
                <div class="md:col-span-3 flex items-center justify-between gap-2">
                    <span class="text-xs text-slate-400">Menampilkan {{ bagianTableRows.length }} kegiatan</span>
                    <button class="btn-soft !px-3 !py-1 text-xs" @click="resetBagianFilter">Reset</button>
                </div>
            </div>
        </div>

        <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
            <div v-if="!bagianTableRows.length" class="px-4 py-12 text-center text-sm text-slate-400">Tidak ada data.</div>
            <div v-else class="hidden overflow-x-auto md:block">
                <table class="w-full border-collapse text-sm">
                    <thead>
                        <tr class="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                            <th class="cursor-pointer p-3" @click="sortBagian('tanggal')">Tanggal <i class="bi" :class="sortBagianIcon('tanggal')"></i></th>
                            <th class="cursor-pointer p-3" @click="sortBagian('bagian')">Bagian <i class="bi" :class="sortBagianIcon('bagian')"></i></th>
                            <th class="cursor-pointer p-3" @click="sortBagian('blok')">Blok <i class="bi" :class="sortBagianIcon('blok')"></i></th>
                            <th class="cursor-pointer p-3" @click="sortBagian('kegiatan')">Kegiatan <i class="bi" :class="sortBagianIcon('kegiatan')"></i></th>
                            <th class="cursor-pointer p-3 text-center" @click="sortBagian('peserta')">Peserta <i class="bi" :class="sortBagianIcon('peserta')"></i></th>
                            <th class="cursor-pointer p-3" @click="sortBagian('ba')">BA <i class="bi" :class="sortBagianIcon('ba')"></i></th>
                            <th class="cursor-pointer p-3" @click="sortBagian('final')">ACC Final <i class="bi" :class="sortBagianIcon('final')"></i></th>
                            <th class="p-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-for="r in bagianTableRows" :key="r.key">
                            <tr class="border-b border-slate-50 hover:bg-slate-50/60">
                                <td class="whitespace-nowrap p-3 text-xs text-slate-500">{{ (r.tanggalList || [r.tanggal]).filter(Boolean).map(v => formatTanggal(v)).join(', ') || '-' }}<span v-if="(r.tanggalList || []).length > 1" class="ml-1 text-[10px] text-slate-400">({{ r.tanggalList.length }} sesi)</span></td>
                                <td class="p-3"><span v-if="!r.__orphan" class="rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">{{ r.bagian }}</span><span v-else class="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">BA tanpa pengajuan</span></td>
                                <td class="p-3 text-xs text-slate-600">{{ r.blok }}</td>
                                <td class="p-3 text-sm font-semibold text-slate-800">{{ r.label }}</td>
                                <td class="p-3 text-center"><button class="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600" @click="toggleBagianExpand(r.key)">{{ r.jumlahPeserta }}</button></td>
                                <td class="p-3">
                                    <div class="flex flex-wrap items-center gap-1">
                                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="bagianStatusBaClass(r.statusBa)">{{ r.statusBa === 'ada' ? 'Ada' : 'Belum' }}</span>
                                        <span v-for="(b, bi) in r.ba" :key="bi" class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="b.sumber === 'Bagian' ? 'bg-brand-50 text-brand-700' : 'bg-indigo-50 text-indigo-700'">{{ b.sumber }}</span>
                                    </div>
                                </td>
                                <td class="p-3"><span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="bagianStatusFinalClass(r.statusFinal)">{{ r.statusFinal === 'ada' ? 'Ada' : 'Belum' }}</span></td>
                                <td class="p-3">
                                    <div class="flex flex-col gap-1 text-xs">
                                        <template v-for="(b, bi) in r.ba" :key="bi"><a v-if="b.fileUrl" :href="b.fileUrl" target="_blank" class="link"><i class="bi bi-file-earmark-pdf"></i> {{ b.baId }}</a></template>
                                        <a v-if="r.linkFinal" :href="r.linkFinal" target="_blank" class="link"><i class="bi bi-eye"></i> Final</a>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="bagian.expanded[r.key]" class="border-b border-slate-50 bg-slate-50/40">
                                <td colspan="8" class="p-4">
                                    <div class="grid gap-4 lg:grid-cols-2">
                                        <div>
                                            <div class="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Peserta ({{ r.jumlahPeserta }})</div>
                                            <div class="space-y-1">
                                                <div v-for="(p, pi) in r.peserta" :key="pi" class="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-xs">
                                                    <span class="font-semibold text-slate-700">{{ p.namaLengkap || '-' }}</span>
                                                    <span class="font-mono text-[10px] text-slate-400">{{ p.npm }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Berita Acara</div>
                                            <div v-if="!r.ba.length" class="text-xs text-slate-400">Belum ada BA.</div>
                                            <div v-for="(b, bi) in r.ba" :key="bi" class="mb-2 rounded-lg bg-white p-2.5 text-xs">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <span class="font-mono font-bold text-slate-700">{{ b.baId }}</span>
                                                    <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="b.sumber === 'Bagian' ? 'bg-brand-50 text-brand-700' : 'bg-indigo-50 text-indigo-700'">{{ b.sumber }}</span>
                                                    <span class="text-slate-400">{{ formatTanggal(b.timestamp) }}</span>
                                                </div>
                                                <div v-if="b.catatan" class="mt-1 text-slate-500">{{ b.catatan }}</div>
                                                <a v-if="b.fileUrl" :href="b.fileUrl" target="_blank" class="link mt-1 inline-block"><i class="bi bi-file-earmark-pdf"></i> Lihat File</a>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
            <div v-else class="divide-y divide-slate-50 md:hidden">
                <div v-for="r in bagianTableRows" :key="'m' + r.key" class="p-4">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <div class="truncate text-sm font-bold text-slate-900">{{ r.label }}</div>
                            <div class="text-[11px] text-slate-400">{{ (r.tanggalList || [r.tanggal]).filter(Boolean).map(v => formatTanggal(v)).join(', ') || '-' }}</div>
                        </div>
                        <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" :class="bagianStatusBaClass(r.statusBa)">{{ r.statusBa === 'ada' ? 'BA Ada' : 'Belum BA' }}</span>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span v-if="!r.__orphan" class="rounded bg-brand-50 px-2 py-0.5 font-bold text-brand-700">{{ r.bagian }}</span>
                        <span v-else class="rounded bg-rose-50 px-2 py-0.5 font-bold text-rose-700">BA tanpa pengajuan</span>
                        <span>{{ r.blok }}</span>
                        <span>· {{ r.jumlahPeserta }} peserta</span>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2 text-xs">
                        <template v-for="(b, bi) in r.ba" :key="bi"><a v-if="b.fileUrl" :href="b.fileUrl" target="_blank" class="link"><i class="bi bi-file-earmark-pdf"></i> {{ b.baId }}</a></template>
                        <a v-if="r.linkFinal" :href="r.linkFinal" target="_blank" class="link"><i class="bi bi-eye"></i> Final</a>
                    </div>
                </div>
            </div>
        </div>
    </template>
</section>
```

- [ ] **Step 3: Tambah CSS util yang belum ada**

Cek apakah class `bg-brand-50`, `text-brand-700`, `bg-indigo-50`, `text-indigo-700`, `bg-amber-50`, `bg-rose-50` sudah ada di blok `<style>` pertama. `bg-brand-50`/`text-brand-700` dipakai tab BA jadi sudah ada. Jika `bg-indigo-50`/`text-indigo-700` belum ada, tambahkan CSS plain di blok `<style>` pertama:

```css
.bg-indigo-50 { background-color: #eef2ff; }
.text-indigo-700 { color: #4338ca; }
.bg-amber-50 { background-color: #fffbeb; }
.text-amber-700 { color: #b45309; }
.bg-rose-50 { background-color: #fff1f2; }
.text-rose-700 { color: #be123c; }
```

- [ ] **Step 4: Verifikasi sintaks inline script**

Run:
```bash
cd /workspace/new-code1-cf && python3 - <<'PY'
import re
html = open('public/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/dashboard_inline.js
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add new-code1-cf/public/dashboard.html
git commit -m "feat(new-code1-cf): new Laporan Bagian audit UI

- summary cards, per-bagian completeness bars, bagian x blok heatmap
- filterable/sortable audit table with BA source badges and expandable peserta
- mobile card layout and SheetJS CDN

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 4: Verifikasi penuh dan deploy

**Files:**
- No source changes.

- [ ] **Step 1: Jalankan seluruh test suite**

Run: `cd new-code1-cf && npx vitest run`
Expected: semua lulus (termasuk 5 test baru).

- [ ] **Step 2: Verifikasi data nyata lewat skrip RPC**

Buat `/tmp/opencode/bagian-check.mjs`:

```js
import fs from 'node:fs';
const src = fs.readFileSync('/workspace/new-code1-cf/public/gs-shim.js', 'utf8');
const win = {};
new Function('window', 'fetch', src)(win, (u, o) => fetch('http://127.0.0.1:8787' + u, o));
const gs = win.google.script.run;
const call = (fn, ...a) => new Promise((r, j) => gs.withSuccessHandler(r).withFailureHandler(j)[fn](...a));
const data = await call('getBagianAggregation', process.env.ADMIN_TOKEN);
console.log('units:', data.units.length, 'orphan:', data.orphanBa.length, 'summary:', JSON.stringify(data.summary));
```

Run: `cd new-code1-cf && ADMIN_TOKEN="$(CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --json --command "SELECT token FROM sessions WHERE role='admin' AND expires_at > strftime('%Y-%m-%dT%H:%M:%S','now') ORDER BY created_at DESC LIMIT 1" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s)[0].results[0].token)})")" node /tmp/opencode/bagian-check.mjs`

Expected: `units` >= 9, `summary.denganBa` menghitung BA Bagian + Admin, `orphanBa` menampilkan BA yang tidak punya pasangan (sebelumnya 2 orphan kini terdeteksi).

- [ ] **Step 3: Verifikasi manual di browser**

Buka dashboard (hard-refresh), tab Laporan Bagian:
1. Kartu ringkasan, bar per bagian, heatmap tampil.
2. Filter Bagian/Blok/Sumber/Status + pencarian + toggle "hanya belum lengkap" + Reset bekerja.
3. Expand peserta dan rincian BA; baris "BA tanpa pengajuan" tampil dengan badge merah.
4. Klik bar/heatmap memfilter tabel.
5. Tombol Ekspor Excel mengunduh `.xlsx` sesuai baris terfilter.
6. Tampilan HP: kartu ringkas tanpa scroll horizontal.

- [ ] **Step 4: Deploy**

Run: `cd new-code1-cf && CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy`
Expected: sukses, dapat Version ID baru.

- [ ] **Step 5: Verifikasi produksi**

Run: `curl -s https://inhal-poc.new-code1-cf.workers.dev/dashboard | grep -c "Audit kelengkapan"`
Expected: `>= 1`.

---

## Catatan Self-Review

- Cakupan spec: Zona 1 (Task 3 Step 2 kartu), Zona 2 (bar + heatmap), Zona 3 (tabel + filter + expand + orphan), ekspor Excel (Task 2 Step 3 + Task 3 Step 1), model data + aturan akurasi (Task 1), HP (Task 3 Step 2), testing (Task 1).
- Tidak ada placeholder; semua langkah berisi kode/perintah nyata.
- Konsistensi nama: `bagianSummary`, `bagianFilteredUnits`, `bagianTableRows`, `bagianBar`, `bagianHeatmap`, `resetBagianFilter`, `sortBagian`, `toggleBagianExpand`, `openBagianFromBar`, `openBagianFromCell`, `exportBagianExcel` dipakai konsisten antara Task 2 dan Task 3.
