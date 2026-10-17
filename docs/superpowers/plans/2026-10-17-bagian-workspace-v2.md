# Panel Bagian v2 — Split Workspace + Mobile Ringkas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merombak `new-code1-cf/public/bagian.html` menjadi workspace 4 menu (Ringkasan, Jadwal, Berita Acara, Riwayat) dengan split list/detail di desktop >=940px dan daftar -> halaman detail penuh di ponsel <940px.

**Architecture:** Frontend murni, satu app Vue global yang sudah ada. Logika status/kegiatan dipindah ke helper murni `public/bagian-state.js` agar bisa diuji tanpa DOM. `bagian.html` memakai helper itu untuk computed, lalu merender satu panel detail bersama untuk Jadwal/Berita Acara/Riwayat. Bootstrap yang ada sudah mengembalikan `rows`, `baList` (dengan `selesai`), dan `jadwalList`; tidak ada RPC baru.

**Tech Stack:** Vue 3 global build, Tailwind inline + CSS kustom, Cloudflare Workers assets, Vitest + `@vue/compiler-dom`.

## Global Constraints

- Tanpa perubahan backend/RPC/skema/migrasi.
- Hanya ubah `new-code1-cf/public/bagian.html`, buat `new-code1-cf/public/bagian-state.js`, dan ubah/tambah file test di `new-code1-cf/test/`.
- Pertahankan fitur: login, cache lokal, polling 30 detik, muat ulang, buat/edit/batalkan jadwal, pilih peserta, buat BA manual/dari jadwal, unggah file, scan PDF, lengkapi draft, filter Blok, pencarian, logout.
- BA draft tetap di Berita Acara sampai `selesai`; BA `selesai` hanya di Riwayat (dan tetap terlihat di Jadwal dengan badge).
- Breakpoint: desktop `@media (min-width: 940px)`, ponsel `@media (max-width: 939.98px)`.
- Copy: "Buat BA", "Lengkapi", "BA selesai", "Pendukung", "Pelaksanaan", "Blok", "Lengkap"/"Belum".
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run <file>`; target akhir `npx vitest run` hijau.
- Commit per task. Jangan menulis trailer `Co-authored-by` manual; hook `prepare-commit-msg` menambahkannya.
- Jangan `git add -A` dari root `/workspace`; add path eksplisit.

---

### Task 1: Helper murni `bagian-state.js`

**Files:**
- Create: `new-code1-cf/public/bagian-state.js`
- Test: `new-code1-cf/test/bagian-state.test.js`

**Interfaces:**
- Consumes: array `rows` dari bootstrap (`idPengajuan`, `npm`, `namaLengkap`, `blok`, `jenis`, `pilihan`, `detail`, `tanggal`, `status`, `baMember`), `baList` (`BA ID`, `Blok`, `Nama Kegiatan`, `Tanggal Pelaksanaan`, `Jam`, `Dosen`, `Label`, `Catatan`, `File URL`, `selesai`, `peserta`), `jadwalList` (`JadwalID`, `Blok`, `NamaKegiatan`, `Tanggal`, `Jam`, `Dosen`, `Catatan`, `baId`, `peserta`).
- Produces: `window.BagianState` dengan `normText`, `dateOnly`, `kegiatanName`, `sameKegiatan`, `baForKegiatan`, `jadwalForKegiatan`, `baForJadwal`, `statusOf`, `unscheduledPeserta`, `groupFullyScheduled`, `buildAllGroups`, `buildKegiatanGroups`, `buildJadwalItems`, `buildBaWorkItems`, `buildRiwayatItems`, `buildStats`, `buildBlokProgress`, `sortByDate`, `matchesQuery`.

- [x] **Step 1: Tulis test yang gagal**

Create `new-code1-cf/test/bagian-state.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadState() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian-state.js'));
  expect(res.status).toBe(200);
  const src = await res.text();
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window.BagianState;
}

const rows = [
  { jenis: 'SGD', pilihan: 'Neurologi', detail: 'A', tanggal: '2026-10-20', blok: '1', status: 'ACC', idPengajuan: 'p1', npm: '001', namaLengkap: 'Ani', baMember: false },
  { jenis: 'SGD', pilihan: 'Neurologi', detail: 'A', tanggal: '2026-10-20', blok: '1', status: 'ACC', idPengajuan: 'p2', npm: '002', namaLengkap: 'Budi', baMember: false },
  { jenis: 'KKD', pilihan: 'Farmasi', detail: '', tanggal: '2026-10-21', blok: '2', status: 'ACC', idPengajuan: 'p3', npm: '003', namaLengkap: 'Cici', baMember: true }
];

const jadwalList = [
  { JadwalID: 'j1', Blok: '1', NamaKegiatan: 'Neurologi - A', Tanggal: '2026-10-20', Jam: '08:00', Dosen: 'Dr. X', Catatan: '', baId: 'ba1', peserta: [{ idPengajuan: 'p1', namaLengkap: 'Ani', npm: '001' }] }
];

const baList = [
  { 'BA ID': 'ba1', Blok: '1', 'Nama Kegiatan': 'Neurologi - A', 'Tanggal Pelaksanaan': '2026-10-20', Jam: '08:00', Dosen: 'Dr. X', Label: '', Catatan: '', 'File URL': '', selesai: true, peserta: [{ namaLengkap: 'Ani', npm: '001' }] },
  { 'BA ID': 'ba2', Blok: '2', 'Nama Kegiatan': 'Farmasi', 'Tanggal Pelaksanaan': '2026-10-21', Jam: '', Dosen: '', Label: 'Sesi 1', Catatan: '', 'File URL': '', selesai: false, peserta: [{ namaLengkap: 'Cici', npm: '003' }] }
];

describe('bagian-state helpers', () => {
  it('menormalkan teks dan mencocokkan kegiatan', async () => {
    const S = await loadState();
    expect(S.normText('  Neurologi - A ')).toBe('neurologi a');
    expect(S.kegiatanName({ pilihan: 'Neurologi', detail: 'A' })).toBe('Neurologi - A');
    expect(S.sameKegiatan('Blok 1', 'Neurologi - A', '1', 'neurologi a')).toBe(true);
    expect(S.sameKegiatan('1', 'Neurologi - A', '2', 'Neurologi - A')).toBe(false);
  });

  it('menurunkan status dari BA dan jadwal', async () => {
    const S = await loadState();
    expect(S.statusOf(null, null)).toBe('acc');
    expect(S.statusOf(null, jadwalList[0])).toBe('terjadwal');
    expect(S.statusOf(baList[1], jadwalList[0])).toBe('draft');
    expect(S.statusOf(baList[0], jadwalList[0])).toBe('selesai');
  });

  it('memilih BA dengan tanggal yang sama lebih dulu', async () => {
    const S = await loadState();
    const list = baList.concat([{ 'BA ID': 'ba3', Blok: '1', 'Nama Kegiatan': 'Neurologi - A', 'Tanggal Pelaksanaan': '2026-10-22', selesai: true }]);
    const found = S.baForKegiatan({ blok: '1', nama: 'Neurologi - A', tanggal: '2026-10-20' }, list);
    expect(found['BA ID']).toBe('ba1');
  });

  it('memisahkan grup semua peserta dan grup sisa BA', async () => {
    const S = await loadState();
    const all = S.buildAllGroups(rows, { statuses: ['ACC'] });
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    expect(all.length).toBe(2);
    expect(pending.length).toBe(1);
    expect(pending[0].peserta.map((p) => p.idPengajuan)).toEqual(['p1', 'p2']);
  });

  it('menghitung peserta yang belum terjadwal', async () => {
    const S = await loadState();
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] })[0];
    expect(S.groupFullyScheduled(pending, jadwalList)).toBe(false);
    expect(S.unscheduledPeserta(pending, jadwalList).map((p) => p.idPengajuan)).toEqual(['p2']);
  });

  it('membangun daftar jadwal tanpa grup yang sudah terjadwal penuh', async () => {
    const S = await loadState();
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    const items = S.buildJadwalItems(pending, jadwalList, baList);
    expect(items.some((i) => i.kind === 'jadwal' && i.key === 'j1')).toBe(true);
    expect(items.some((i) => i.kind === 'group' && i.key === pending[0].key)).toBe(true);
    const full = [{ idPengajuan: 'p1' }, { idPengajuan: 'p2' }];
    const fullGroup = Object.assign({}, pending[0], { peserta: full });
    const withFull = S.buildJadwalItems([fullGroup], jadwalList, baList);
    expect(withFull.some((i) => i.kind === 'group')).toBe(false);
  });

  it('membangun antrean BA: draft masuk, selesai tidak', async () => {
    const S = await loadState();
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    const items = S.buildBaWorkItems(pending, S.buildRiwayatItems(baList).filter(() => false).concat([baList[1]]), jadwalList);
    expect(items.some((i) => i.kind === 'ba' && i.key === 'ba2')).toBe(true);
    expect(items.some((i) => i.kind === 'ba' && i.key === 'ba1')).toBe(false);
    expect(items.some((i) => i.kind === 'group')).toBe(true);
  });

  it('membangun riwayat hanya BA selesai dan mengurutkan terbaru', async () => {
    const S = await loadState();
    const items = S.buildRiwayatItems(baList);
    expect(items.length).toBe(1);
    expect(items[0].key).toBe('ba1');
  });

  it('menghitung statistik dan progres blok', async () => {
    const S = await loadState();
    const all = S.buildAllGroups(rows, { statuses: ['ACC'] });
    const pending = S.buildKegiatanGroups(rows, { statuses: ['ACC'] });
    const stats = S.buildStats({ rows, kegiatanGroups: pending, allGroups: all, baList, jadwalList });
    expect(stats.totalPeserta).toBe(3);
    expect(stats.draftBa).toBe(1);
    expect(stats.baSelesai).toBe(1);
    expect(stats.belumDijadwalkan).toBe(1);
    const progress = S.buildBlokProgress(all, baList);
    expect(progress.find((b) => b.blok === '1')).toEqual({ blok: '1', total: 1, done: 1, persen: 100 });
    expect(progress.find((b) => b.blok === '2')).toEqual({ blok: '2', total: 1, done: 0, persen: 0 });
  });

  it('mencocokkan pencarian pada nama, dosen, dan peserta', async () => {
    const S = await loadState();
    const items = S.buildRiwayatItems(baList);
    expect(S.matchesQuery(items[0], 'ani')).toBe(true);
    expect(S.matchesQuery(items[0], 'dr x')).toBe(true);
    expect(S.matchesQuery(items[0], 'tidak ada')).toBe(false);
  });
});
```

- [x] **Step 2: Jalankan test, pastikan gagal**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-state.test.js`
Expected: FAIL — `bagian-state.js` 404 / `BagianState` undefined.

- [x] **Step 3: Implementasi `public/bagian-state.js`**

Create `new-code1-cf/public/bagian-state.js`:

```js
(function (root) {
  'use strict';

  function normText(v) {
    return String(v == null ? '' : v)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dateOnly(v) {
    var m = String(v == null ? '' : v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }

  function kegiatanName(g) {
    var pilihan = String((g && g.pilihan) || '').trim();
    var detail = String((g && g.detail) || '').trim();
    return pilihan + (detail ? ' - ' + detail : '');
  }

  function normalizeKey(v) {
    return normText(v).replace(/ /g, '');
  }

  function sameKegiatan(blokA, namaA, blokB, namaB) {
    return normalizeKey(blokA) === normalizeKey(blokB)
      && normalizeKey(namaA) === normalizeKey(namaB);
  }

  function latest(list, getDate) {
    return list.slice().sort(function (a, b) {
      return String(getDate(b) || '').localeCompare(String(getDate(a) || ''));
    })[0] || null;
  }

  function matchByDate(candidates, refDate, getDate) {
    var tgl = dateOnly(refDate);
    if (!tgl) return null;
    var exact = candidates.filter(function (item) { return dateOnly(getDate(item)) === tgl; });
    return exact.length ? latest(exact, getDate) : null;
  }

  function baForKegiatan(ref, baList) {
    var blok = ref && ref.blok;
    var nama = ref && ref.nama;
    var candidates = (baList || []).filter(function (b) {
      return sameKegiatan(blok, nama, b.Blok, b['Nama Kegiatan']);
    });
    if (!candidates.length) return null;
    return matchByDate(candidates, ref && ref.tanggal, function (b) { return b['Tanggal Pelaksanaan']; })
      || latest(candidates, function (b) { return b['Tanggal Pelaksanaan']; });
  }

  function jadwalForKegiatan(ref, jadwalList) {
    var blok = ref && ref.blok;
    var nama = ref && ref.nama;
    var candidates = (jadwalList || []).filter(function (j) {
      return sameKegiatan(blok, nama, j.Blok, j.NamaKegiatan);
    });
    if (!candidates.length) return null;
    return matchByDate(candidates, ref && ref.tanggal, function (j) { return j.Tanggal; })
      || latest(candidates, function (j) { return j.Tanggal; });
  }

  function baForJadwal(jadwal, baList) {
    if (!jadwal) return null;
    var id = String(jadwal.baId || '').trim();
    if (id) {
      var found = (baList || []).filter(function (b) {
        return String(b['BA ID'] || '').trim() === id;
      })[0];
      if (found) return found;
    }
    return baForKegiatan({ blok: jadwal.Blok, nama: jadwal.NamaKegiatan, tanggal: jadwal.Tanggal }, baList);
  }

  function statusOf(ba, jadwal) {
    if (ba) return ba.selesai ? 'selesai' : 'draft';
    return jadwal ? 'terjadwal' : 'acc';
  }

  function scheduledIdsFor(g, jadwalList) {
    var ids = {};
    (jadwalList || []).forEach(function (j) {
      if (!sameKegiatan(g.blok, kegiatanName(g), j.Blok, j.NamaKegiatan)) return;
      (j.peserta || []).forEach(function (p) { ids[String(p.idPengajuan)] = true; });
    });
    return ids;
  }

  function unscheduledPeserta(g, jadwalList) {
    var ids = scheduledIdsFor(g, jadwalList);
    return (g.peserta || []).filter(function (p) { return !ids[String(p.idPengajuan)]; });
  }

  function groupFullyScheduled(g, jadwalList) {
    var peserta = g.peserta || [];
    if (!peserta.length) return false;
    var ids = scheduledIdsFor(g, jadwalList);
    return peserta.every(function (p) { return !!ids[String(p.idPengajuan)]; });
  }

  function groupRows(rows, options, pendingOnly) {
    var opts = options || {};
    var statuses = opts.statuses || ['ACC'];
    var finalOnly = opts.finalOnly !== false;
    var map = {};
    (rows || []).forEach(function (r) {
      if (pendingOnly && r.baMember) return;
      var key = [r.jenis, r.pilihan, r.detail, r.tanggal, r.blok].join('|');
      var g = map[key];
      if (!g) {
        g = map[key] = {
          key: key,
          jenis: r.jenis,
          pilihan: r.pilihan,
          detail: r.detail,
          tanggal: r.tanggal,
          blok: r.blok,
          label: kegiatanName(r),
          nama: kegiatanName(r),
          peserta: [],
          statusCounts: {},
          blocked: false
        };
      }
      g.statusCounts[r.status] = (g.statusCounts[r.status] || 0) + 1;
      if (statuses.indexOf(r.status) !== -1) {
        g.peserta.push({
          idPengajuan: r.idPengajuan,
          npm: r.npm,
          namaLengkap: r.namaLengkap,
          blok: r.blok,
          statusPengajuan: r.status,
          baMember: !!r.baMember
        });
      }
      if (finalOnly && r.status === 'Menunggu') g.blocked = true;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (g) { return !g.blocked && g.peserta.length > 0; })
      .map(function (g) { g.statusOrder = Object.keys(g.statusCounts); return g; });
  }

  function buildAllGroups(rows, options) {
    return groupRows(rows, options, false);
  }

  function buildKegiatanGroups(rows, options) {
    return groupRows(rows, options, true);
  }

  function buildJadwalItems(kegiatanGroups, jadwalList, baList) {
    var items = (jadwalList || []).map(function (j) {
      var ba = baForJadwal(j, baList);
      return {
        id: 'j:' + j.JadwalID,
        kind: 'jadwal',
        key: j.JadwalID,
        blok: j.Blok,
        nama: j.NamaKegiatan,
        tanggal: j.Tanggal,
        jadwal: j,
        ba: ba,
        status: statusOf(ba, j),
        peserta: j.peserta || [],
        dosen: j.Dosen || ''
      };
    });
    (kegiatanGroups || []).forEach(function (g) {
      if (groupFullyScheduled(g, jadwalList)) return;
      var peserta = unscheduledPeserta(g, jadwalList);
      if (!peserta.length) return;
      var ref = { blok: g.blok, nama: g.nama, tanggal: g.tanggal };
      var jadwal = jadwalForKegiatan(ref, jadwalList);
      var ba = baForKegiatan(ref, baList);
      items.push({
        id: 'g:' + g.key,
        kind: 'group',
        key: g.key,
        blok: g.blok,
        nama: g.nama,
        tanggal: g.tanggal,
        jadwal: jadwal,
        ba: ba,
        status: 'acc',
        peserta: peserta,
        group: g,
        dosen: ''
      });
    });
    return items;
  }

  function buildBaWorkItems(kegiatanGroups, draftBaList, jadwalList) {
    var items = [];
    (draftBaList || []).forEach(function (b) {
      var ref = { blok: b.Blok, nama: b['Nama Kegiatan'], tanggal: b['Tanggal Pelaksanaan'] };
      items.push({
        id: 'b:' + b['BA ID'],
        kind: 'ba',
        key: b['BA ID'],
        blok: b.Blok,
        nama: b['Nama Kegiatan'],
        tanggal: b['Tanggal Pelaksanaan'],
        ba: b,
        jadwal: jadwalForKegiatan(ref, jadwalList),
        status: 'draft',
        peserta: b.peserta || [],
        dosen: b.Dosen || ''
      });
    });
    (kegiatanGroups || []).forEach(function (g) {
      var ref = { blok: g.blok, nama: g.nama, tanggal: g.tanggal };
      var jadwal = jadwalForKegiatan(ref, jadwalList);
      items.push({
        id: 'g:' + g.key,
        kind: 'group',
        key: g.key,
        blok: g.blok,
        nama: g.nama,
        tanggal: g.tanggal,
        jadwal: jadwal,
        ba: baForKegiatan(ref, jadwalList),
        status: jadwal ? 'terjadwal' : 'acc',
        peserta: g.peserta,
        group: g,
        dosen: ''
      });
    });
    return items;
  }

  function sortByDate(items, direction) {
    var dir = direction === 'asc' ? 1 : -1;
    return items.slice().sort(function (a, b) {
      var ta = dateOnly(a.tanggal);
      var tb = dateOnly(b.tanggal);
      if (ta !== tb) return (ta < tb ? -1 : 1) * dir;
      return String(a.nama || '').localeCompare(String(b.nama || ''));
    });
  }

  function buildRiwayatItems(baList) {
    var items = (baList || []).filter(function (b) { return !!b.selesai; }).map(function (b) {
      return {
        id: 'b:' + b['BA ID'],
        kind: 'ba',
        key: b['BA ID'],
        blok: b.Blok,
        nama: b['Nama Kegiatan'],
        tanggal: b['Tanggal Pelaksanaan'],
        ba: b,
        status: 'selesai',
        peserta: b.peserta || [],
        dosen: b.Dosen || ''
      };
    });
    return sortByDate(items, 'desc');
  }

  function buildStats(input) {
    var rows = input.rows || [];
    var groups = input.kegiatanGroups || [];
    var allGroups = input.allGroups || [];
    var baList = input.baList || [];
    var jadwalList = input.jadwalList || [];
    var selesai = baList.filter(function (b) { return !!b.selesai; });
    var done = allGroups.filter(function (g) {
      var ba = baForKegiatan({ blok: g.blok, nama: g.nama, tanggal: g.tanggal }, baList);
      return !!(ba && ba.selesai);
    });
    return {
      totalPeserta: rows.length,
      belumDijadwalkan: groups.filter(function (g) {
        return !groupFullyScheduled(g, jadwalList);
      }).length,
      draftBa: baList.filter(function (b) { return !b.selesai; }).length,
      baSelesai: selesai.length,
      persenSelesai: allGroups.length ? Math.round(done.length * 100 / allGroups.length) : 0
    };
  }

  function buildBlokProgress(allGroups, baList) {
    var map = {};
    (allGroups || []).forEach(function (g) {
      var blok = String(g.blok || '').trim() || '-';
      if (!map[blok]) map[blok] = { blok: blok, total: 0, done: 0, persen: 0 };
      map[blok].total += 1;
      var ba = baForKegiatan({ blok: g.blok, nama: g.nama, tanggal: g.tanggal }, baList);
      if (ba && ba.selesai) map[blok].done += 1;
    });
    return Object.keys(map).map(function (k) {
      var row = map[k];
      row.persen = row.total ? Math.round(row.done * 100 / row.total) : 0;
      return row;
    }).sort(function (a, b) { return a.blok.localeCompare(b.blok); });
  }

  function matchesQuery(item, query) {
    var q = normText(query);
    if (!q) return true;
    var parts = [item.nama, item.blok, item.dosen];
    if (item.jadwal) parts.push(item.jadwal.Dosen, item.jadwal.Catatan);
    if (item.ba) parts.push(item.ba.Dosen, item.ba.Label, item.ba.Catatan);
    (item.peserta || []).forEach(function (p) { parts.push(p.namaLengkap, p.npm); });
    ((item.ba && item.ba.peserta) || []).forEach(function (p) { parts.push(p.namaLengkap, p.npm); });
    return normText(parts.join(' ')).indexOf(q) !== -1;
  }

  root.BagianState = {
    normText: normText,
    dateOnly: dateOnly,
    kegiatanName: kegiatanName,
    sameKegiatan: sameKegiatan,
    baForKegiatan: baForKegiatan,
    jadwalForKegiatan: jadwalForKegiatan,
    baForJadwal: baForJadwal,
    statusOf: statusOf,
    unscheduledPeserta: unscheduledPeserta,
    groupFullyScheduled: groupFullyScheduled,
    buildAllGroups: buildAllGroups,
    buildKegiatanGroups: buildKegiatanGroups,
    buildJadwalItems: buildJadwalItems,
    buildBaWorkItems: buildBaWorkItems,
    buildRiwayatItems: buildRiwayatItems,
    buildStats: buildStats,
    buildBlokProgress: buildBlokProgress,
    sortByDate: sortByDate,
    matchesQuery: matchesQuery
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [x] **Step 4: Jalankan test, pastikan lulus**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-state.test.js`
Expected: PASS, 10 test.

- [x] **Step 5: Commit**

```bash
cd /workspace
git add new-code1-cf/public/bagian-state.js new-code1-cf/test/bagian-state.test.js
git commit -m "feat(bagian): tambah helper murni status kegiatan dan antrean BA"
```

---

### Task 2: Shell 4 menu, Ringkasan, bottom nav, FAB

**Files:**
- Modify: `new-code1-cf/public/bagian.html`
- Modify: `new-code1-cf/test/bagian-template.test.js`
- Modify: `new-code1-cf/test/bagian-jadwal-template.test.js`
- Test: `new-code1-cf/test/bagian-workspace-v2.test.js`

**Interfaces:**
- Consumes: `window.BagianState` dari Task 1.
- Produces: state `navItems`, `sel`, `mobileDetail`, `q`, `jadwalFilter`, `baTabFilter`; `activeTab` default `'ringkasan'`; computed `allKegiatanGroups`, `ringkasanStats`, `blokProgress`, `upcomingJadwal`, `jadwalLewatTanpaBa`; method `setTab(t, opts)`, `openBaWorklist()`.

- [ ] **Step 1: Tulis test yang gagal**

Create `new-code1-cf/test/bagian-workspace-v2.test.js`:

```js
import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  if (start === -1) throw new Error('#app root not found');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') {
      depth -= 1;
      if (depth === 0) { end = re.lastIndex; break; }
    } else {
      depth += 1;
    }
  }
  if (end === -1) throw new Error('#app root close not found');
  return slice.slice(0, end);
}

function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => {
      const el = {
        _html: '',
        set innerHTML(v) { this._html = String(v); },
        get innerHTML() { return this._html; },
        get textContent() { return this._html; },
        get children() {
          const match = this._html.match(/^<div foo="([\s\S]*)">$/);
          const value = match ? match[1] : this._html;
          return [{ getAttribute: () => value }];
        }
      };
      return el;
    }
  };
}

async function loadBagianHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('bagian workspace v2 — shell', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadBagianHtml();
    compile(extractAppTemplate(html), {
      onError: (e) => { throw new Error(e.message); },
      onWarn: (w) => { throw new Error('warn: ' + w.message); }
    });
  });

  it('memakai empat menu final tanpa menu Peserta', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain("activeTab: 'ringkasan'");
    expect(html).toContain("label: 'Ringkasan'");
    expect(html).toContain("label: 'Jadwal'");
    expect(html).toContain("label: 'Berita Acara'");
    expect(html).toContain("label: 'Riwayat'");
    expect(html).not.toContain('<h2 class="text-base font-bold text-slate-900">Daftar Peserta</h2>');
  });

  it('menyediakan top nav desktop, bottom nav, dan FAB', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="top-nav"');
    expect(html).toContain('class="bottom-nav"');
    expect(html).toContain('class="fab"');
    expect(html).toContain('aria-current');
    expect(html).toContain('@media (min-width: 940px)');
    expect(html).toContain('@media (max-width: 939.98px)');
  });

  it('menampilkan kartu Ringkasan', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Total Peserta');
    expect(html).toContain('Belum Dijadwalkan');
    expect(html).toContain('Draft BA');
    expect(html).toContain('BA Selesai');
    expect(html).toContain('Perlu Tindakan');
    expect(html).toContain('Kelengkapan per Blok');
    expect(html).toContain('Jadwal Terdekat');
    expect(html).toContain("setTab('ba', { filter: 'draft' })");
  });

  it('memuat helper bagian-state sebelum app-common', async () => {
    const html = await loadBagianHtml();
    const stateAt = html.indexOf('<script src="/bagian-state.js"></script>');
    const commonAt = html.indexOf('<script src="/app-common.js"></script>');
    expect(stateAt).toBeGreaterThan(-1);
    expect(commonAt).toBeGreaterThan(stateAt);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-workspace-v2.test.js`
Expected: FAIL — `activeTab: 'ringkasan'`, `label: 'Ringkasan'`, `top-nav` belum ada.

- [ ] **Step 3: Perbarui test lama yang menyentuh markup yang diganti**

Edit `new-code1-cf/test/bagian-template.test.js`, ganti dua test berikut:

```js
  it('kartu panel ditata vertikal dalam pembungkus space-y-5', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="space-y-5"');
  });

  it('kartu Upload BA hanya tampil pada tab Berita Acara', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain(`v-if="activeTab==='ba'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"`);
  });
```

menjadi:

```js
  it('memakai shell workspace dengan bottom nav', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="space-y-5"');
    expect(html).toContain('class="workspace"');
    expect(html).toContain('class="bottom-nav"');
  });

  it('kartu Upload BA hanya tampil pada tab Berita Acara', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain(`v-if="activeTab==='ba'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"`);
  });
```

Edit `new-code1-cf/test/bagian-jadwal-template.test.js`, ganti test "tetap mempertahankan fitur produksi Daftar Peserta":

```js
  it('tetap mempertahankan fitur produksi Daftar Peserta', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Daftar Peserta');
    expect(html).toContain('filteredRows');
    expect(html).toContain('openBaPicker');
  });
```

menjadi:

```js
  it('mengganti Daftar Peserta dengan workspace empat menu', async () => {
    const html = await loadBagianHtml();
    expect(html).not.toContain('Daftar Peserta');
    expect(html).toContain('openBaPicker');
    expect(html).toContain("label: 'Ringkasan'");
    expect(html).toContain('class="workspace"');
  });
```

- [ ] **Step 4: Tambahkan CSS breakpoint dan shell**

Di `new-code1-cf/public/bagian.html`, sisipkan CSS berikut **sebelum** `@media (min-width: 1024px) {` di `<style>` pertama (sekitar baris 44):

```css
        .app-main { padding-bottom: calc(6.25rem + env(safe-area-inset-bottom, 0px)); }
        .top-nav { display: none; align-items: center; gap: .2rem; border-radius: 1rem; background: rgba(255,255,255,.12); padding: .2rem; }
        .top-nav button { display: inline-flex; align-items: center; gap: .35rem; border-radius: .75rem; padding: .45rem .7rem; font-size: .78rem; font-weight: 700; color: #e0e7ff; }
        .top-nav button[aria-selected="true"] { background: #fff; color: #4338ca; }
        .top-search { display: none; width: 13rem; border-radius: .85rem; border: 0; background: rgba(255,255,255,.14); padding: .45rem .8rem; font-size: .78rem; color: #fff; outline: none; }
        .top-search::placeholder { color: #c7d2fe; }
        .bottom-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; gap: .15rem; border-top: 1px solid #e2e8f0; background: #fff; padding: .35rem .4rem calc(env(safe-area-inset-bottom, 0px) + .35rem); }
        .bottom-nav button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .1rem; border-radius: .8rem; padding: .35rem .15rem; font-size: 10px; font-weight: 700; color: #94a3b8; }
        .bottom-nav button[aria-current="page"] { background: #eef2ff; color: #4f46e5; }
        .fab { position: fixed; right: 1rem; bottom: calc(5.2rem + env(safe-area-inset-bottom, 0px)); z-index: 45; display: inline-flex; align-items: center; gap: .4rem; border-radius: 999px; background: #4f46e5; padding: .8rem 1.1rem; font-size: .85rem; font-weight: 700; color: #fff; box-shadow: 0 10px 24px rgba(79,70,229,.4); }
        .workspace { display: block; }
        .ws-list { min-width: 0; }
        .ws-detail { display: none; }
        .detail-bar { display: flex; align-items: center; gap: .75rem; border-bottom: 1px solid #f1f5f9; padding: 1rem; }
        .detail-back { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: .75rem; background: #f8fafc; color: #475569; }
        .riwayat-cards { display: block; }
        .riwayat-table { display: none; }
        @media (min-width: 940px) {
            .app-main { padding-bottom: 2rem; }
            .top-nav { display: flex; }
            .top-search { display: block; }
            .bottom-nav, .fab { display: none; }
            .ws-detail { display: block; position: sticky; top: 5.5rem; max-height: calc(100vh - 6.5rem); overflow-y: auto; }
            .workspace--split { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 1.25rem; align-items: start; }
            .workspace--riwayat.has-detail { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 1.25rem; align-items: start; }
            .detail-back { display: none; }
            .riwayat-cards { display: none; }
            .riwayat-table { display: table; width: 100%; border-collapse: collapse; }
        }
        @media (max-width: 939.98px) {
            .ws-detail.is-open { display: block; position: fixed; inset: 0; z-index: 60; overflow-y: auto; background: #f8fafc; padding: .75rem .75rem calc(6rem + env(safe-area-inset-bottom, 0px)); }
        }
```

- [ ] **Step 5: Muat helper sebelum app**

Di dekat `<script src="/app-common.js"></script>` (baris 658), tambahkan sebelum baris itu:

```html
    <script src="/bagian-state.js"></script>
```

- [ ] **Step 6: Tambahkan nav desktop, pencarian, dan Ringkasan**

Di header, setelah blok `<a :href="appUrl" ...>...</a>` dan sebelum tombol Keluar, sisipkan:

```html
                        <nav class="top-nav" role="tablist" aria-label="Navigasi panel bagian">
                            <button v-for="t in navItems" :key="t.id" type="button" role="tab" :aria-selected="activeTab===t.id" :class="activeTab===t.id ? '' : ''" @click="setTab(t.id)">
                                <i class="bi" :class="t.icon"></i><span>{{ t.label }}</span>
                            </button>
                        </nav>
```

Bungkus tombol Keluar dengan grup pencarian:

```html
                        <div class="flex items-center gap-2">
                            <input v-if="activeTab!=='ringkasan'" v-model="q" type="search" class="top-search" placeholder="Cari kegiatan, peserta...">
                            <button class="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20" @click="logout">
                                <i class="bi bi-box-arrow-right"></i> Keluar
                            </button>
                        </div>
```

Tambahkan class `app-main` pada `<main>`:

```html
                <main class="app-main safe-b flex-1 px-4 py-5 sm:px-6 md:px-8">
```

Ganti blok dari `<!-- ===== DAFTAR PESERTA (semua status) ===== -->` sampai tepat sebelum `<!-- ===== TAB BAR ===== -->` dengan Ringkasan dan pembuka workspace:

```html
                    <!-- ===== RINGKASAN ===== -->
                    <section v-if="activeTab==='ringkasan'" class="space-y-5">
                        <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Peserta</div>
                                <div class="mt-1 text-2xl font-extrabold text-slate-900">{{ ringkasanStats.totalPeserta }}</div>
                                <div class="text-[11px] text-slate-400">data pengajuan</div>
                            </div>
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Belum Dijadwalkan</div>
                                <div class="mt-1 text-2xl font-extrabold text-slate-900">{{ ringkasanStats.belumDijadwalkan }}</div>
                                <div class="text-[11px] text-slate-400">kegiatan</div>
                            </div>
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Draft BA</div>
                                <div class="mt-1 text-2xl font-extrabold text-amber-600">{{ ringkasanStats.draftBa }}</div>
                                <div class="text-[11px] text-slate-400">perlu dilengkapi</div>
                            </div>
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">BA Selesai</div>
                                <div class="mt-1 text-2xl font-extrabold text-emerald-600">{{ ringkasanStats.baSelesai }}</div>
                                <div class="text-[11px] text-slate-400">{{ ringkasanStats.persenSelesai }}% kegiatan</div>
                            </div>
                        </div>

                        <div class="grid gap-4 xl:grid-cols-2">
                            <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
                                <div class="section-title"><i class="bi bi-list-check"></i> Perlu Tindakan</div>
                                <div class="space-y-2">
                                    <button type="button" class="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left" @click="setTab('ba', { filter: 'draft' })">
                                        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600"><i class="bi bi-hourglass-split"></i></div>
                                        <div class="min-w-0 flex-1"><div class="text-sm font-bold text-slate-900">Draft BA</div><div class="text-[11px] text-slate-500">Dosen/tanggal/jam belum lengkap</div></div>
                                        <span class="chip bg-white text-amber-700">{{ ringkasanStats.draftBa }}</span>
                                    </button>
                                    <button type="button" class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left" @click="setTab('jadwal', { filter: 'belum' })">
                                        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><i class="bi bi-calendar-plus"></i></div>
                                        <div class="min-w-0 flex-1"><div class="text-sm font-bold text-slate-900">Belum dijadwalkan</div><div class="text-[11px] text-slate-500">Kegiatan ACC tanpa jadwal</div></div>
                                        <span class="chip bg-slate-100 text-slate-600">{{ ringkasanStats.belumDijadwalkan }}</span>
                                    </button>
                                    <button type="button" class="flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left" @click="setTab('ba', { filter: 'belum' })">
                                        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-rose-600"><i class="bi bi-exclamation-triangle"></i></div>
                                        <div class="min-w-0 flex-1"><div class="text-sm font-bold text-slate-900">Jadwal lewat tanpa BA</div><div class="text-[11px] text-slate-500">Sudah lewat tanggal pelaksanaan</div></div>
                                        <span class="chip bg-white text-rose-700">{{ jadwalLewatTanpaBa.length }}</span>
                                    </button>
                                </div>
                            </div>
                            <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
                                <div class="section-title"><i class="bi bi-grid-3x3-gap"></i> Kelengkapan per Blok</div>
                                <div v-if="!blokProgress.length" class="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Belum ada data.</div>
                                <div v-else class="space-y-3">
                                    <button v-for="b in blokProgress" :key="b.blok" type="button" class="w-full text-left" @click="setTab('ba', { blok: b.blok })">
                                        <div class="mb-1 flex items-center justify-between gap-2">
                                            <span class="text-xs font-bold text-slate-700">Blok {{ b.blok }}</span>
                                            <span class="text-[11px] text-slate-500">{{ b.done }}/{{ b.total }} · {{ b.persen }}%</span>
                                        </div>
                                        <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div class="h-full rounded-full bg-brand-600" :style="{ width: b.persen + '%' }"></div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
                            <div class="section-title"><i class="bi bi-calendar-week"></i> Jadwal Terdekat</div>
                            <div v-if="!upcomingJadwal.length" class="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Belum ada jadwal mendatang.</div>
                            <div v-else class="space-y-2">
                                <button v-for="j in upcomingJadwal" :key="j.JadwalID" type="button" class="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left" @click="setTab('jadwal'); selectItem('jadwal', j.JadwalID)">
                                    <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><i class="bi bi-calendar-check"></i></div>
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate text-sm font-semibold text-slate-900">Blok {{ j.Blok }} · {{ j.NamaKegiatan }}</div>
                                        <div class="text-[11px] text-slate-400">{{ formatTanggal(j.Tanggal) }}<template v-if="j.Jam"> · {{ j.Jam }}</template><template v-if="j.Dosen"> · {{ j.Dosen }}</template></div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </section>

                    <!-- ===== WORKSPACE ===== -->
                    <div v-else class="workspace" :class="{ 'workspace--split': activeTab==='jadwal' || activeTab==='ba', 'workspace--riwayat': activeTab==='riwayat', 'has-detail': !!selectedItem }">
                        <div class="ws-list">
```

Hapus blok tab bar lama:

```html
                    <!-- ===== TAB BAR ===== -->
                    <div class="flex gap-1 rounded-2xl bg-white p-1 shadow-soft ring-1 ring-slate-100" role="tablist">
                        ... tiga tombol ...
                    </div>
```

- [ ] **Step 7: Tutup workspace, tambahkan panel detail placeholder, bottom nav, FAB**

Setelah kartu Riwayat lama (`v-if="activeTab==='riwayat'"`) dan sebelum penutup `</div></div>` milik `space-y-5`/`max-w-7xl`, sisipkan:

```html
                        </div>
                        <aside class="ws-detail" :class="{ 'is-open': mobileDetail }" role="dialog" aria-modal="true" aria-label="Detail kegiatan">
                            <div class="rounded-2xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-100">
                                <i class="bi bi-layout-sidebar-inset mb-2 block text-3xl text-slate-300"></i>
                                <p class="text-sm text-slate-500">Pilih kegiatan untuk melihat detail.</p>
                            </div>
                        </aside>
                    </div>
```

Di dalam panel view, sebelum penutup `</div>` terakhir (setelah `</main>`), sisipkan:

```html
                <nav class="bottom-nav" aria-label="Navigasi utama">
                    <button v-for="t in navItems" :key="'b-' + t.id" type="button" :aria-current="activeTab===t.id ? 'page' : null" @click="setTab(t.id)">
                        <i class="bi" :class="t.icon"></i><span>{{ t.label }}</span>
                    </button>
                </nav>
                <button v-if="(activeTab==='ringkasan' || activeTab==='ba') && !mobileDetail" type="button" class="fab" aria-label="Buat BA" @click="openBaWorklist">
                    <i class="bi bi-file-earmark-plus"></i><span>Buat BA</span>
                </button>
```

- [ ] **Step 8: Tambahkan state, computed, dan method**

Di `data()`, tambahkan setelah `activeTab`:

```js
                    sel: { kind: '', key: '' },
                    mobileDetail: false,
                    q: '',
                    jadwalFilter: 'semua',
                    baTabFilter: 'semua',
                    formDirty: false,
                    navItems: [
                        { id: 'ringkasan', label: 'Ringkasan', icon: 'bi-house' },
                        { id: 'jadwal', label: 'Jadwal', icon: 'bi-calendar-plus' },
                        { id: 'ba', label: 'Berita Acara', icon: 'bi-file-earmark-text' },
                        { id: 'riwayat', label: 'Riwayat', icon: 'bi-clock-history' }
                    ],
```

Ubah `activeTab: 'jadwal'` menjadi `activeTab: 'ringkasan'`.

Di `computed`, tambahkan:

```js
                allKegiatanGroups() {
                    const B = window.BagianState;
                    return B.buildAllGroups(this.rows, {
                        statuses: this.baConfig.statuses || ['ACC'],
                        finalOnly: this.baConfig.finalOnly !== false
                    });
                },
                ringkasanStats() {
                    const B = window.BagianState;
                    return B.buildStats({
                        rows: this.rows,
                        kegiatanGroups: this.kegiatanGroups,
                        allGroups: this.allKegiatanGroups,
                        baList: this.baList,
                        jadwalList: this.jadwalList
                    });
                },
                blokProgress() {
                    return window.BagianState.buildBlokProgress(this.allKegiatanGroups, this.baList);
                },
                jadwalLewatTanpaBa() {
                    const B = window.BagianState;
                    const today = B.dateOnly(new Date().toISOString());
                    return this.jadwalList.filter(function (j) {
                        const tgl = B.dateOnly(j.Tanggal);
                        return !j.punyaBa && !!tgl && tgl < today;
                    });
                },
                upcomingJadwal() {
                    const B = window.BagianState;
                    const today = B.dateOnly(new Date().toISOString());
                    return this.jadwalList
                        .filter(function (j) { return B.dateOnly(j.Tanggal) >= today; })
                        .sort(function (a, b) { return String(a.Tanggal).localeCompare(String(b.Tanggal)); })
                        .slice(0, 5);
                },
                selectedItem() {
                    const B = window.BagianState;
                    const kind = this.sel && this.sel.kind;
                    const key = this.sel && this.sel.key;
                    if (!kind || !key) return null;
                    if (kind === 'jadwal') {
                        return this.jadwalItems.find(function (i) { return i.kind === 'jadwal' && i.key === key; }) || null;
                    }
                    if (kind === 'ba') {
                        return (this.baWorkItems || []).find(function (i) { return i.kind === 'ba' && i.key === key; })
                            || (this.riwayatItems || []).find(function (i) { return i.kind === 'ba' && i.key === key; })
                            || null;
                    }
                    return this.jadwalItems.find(function (i) { return i.kind === 'group' && i.key === key; })
                        || (this.baWorkItems || []).find(function (i) { return i.kind === 'group' && i.key === key; })
                        || null;
                },
```

Di `methods`, tambahkan:

```js
                statusLabel(s) {
                    return { acc: 'Belum dijadwalkan', terjadwal: 'Sudah dijadwalkan', draft: 'Draft BA', selesai: 'BA selesai' }[s] || s;
                },
                statusBadgeClass(s) {
                    return {
                        acc: 'bg-slate-100 text-slate-600',
                        terjadwal: 'bg-brand-50 text-brand-700',
                        draft: 'bg-amber-50 text-amber-700',
                        selesai: 'bg-emerald-50 text-emerald-700'
                    }[s] || 'bg-slate-100 text-slate-600';
                },
                markFormDirty() { this.formDirty = true; },
                openBaWorklist() {
                    this.setTab('ba');
                    window.scrollTo(0, 0);
                },
```

Ganti `setTab(t)` yang lama dengan:

```js
                setTab(t, opts) {
                    const o = opts || {};
                    this.activeTab = t;
                    this.q = '';
                    this.sel = { kind: '', key: '' };
                    this.mobileDetail = false;
                    this.formDirty = false;
                    this.jadwal.open = false;
                    this.ba.open = false;
                    this.ba.lengkapi = null;
                    if (t === 'jadwal') this.jadwalFilter = o.filter || 'semua';
                    if (t === 'ba') this.baTabFilter = o.filter || 'semua';
                    if (t === 'riwayat') this.fBlok = o.blok || '';
                    if (o.blok && t === 'ba') this.fBlok = o.blok;
                    window.scrollTo(0, 0);
                },
```

`selectedItem` di Task 2 merujuk `jadwalItems`, `baWorkItems`, `riwayatItems` yang belum ada. Tambahkan computed sementara yang kosong agar tidak error saat runtime:

```js
                jadwalItems() { return window.BagianState.buildJadwalItems(this.kegiatanGroups, this.jadwalList, this.baList); },
                baWorkItems() { return window.BagianState.buildBaWorkItems(this.kegiatanGroups, this.draftBaList, this.jadwalList); },
                riwayatItems() { return window.BagianState.buildRiwayatItems(this.baList); },
```

- [ ] **Step 9: Jalankan test, pastikan lulus**

Run:

```bash
cd /workspace/new-code1-cf
npx vitest run test/bagian-workspace-v2.test.js test/bagian-template.test.js test/bagian-jadwal-template.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd /workspace
git add new-code1-cf/public/bagian.html new-code1-cf/test/bagian-workspace-v2.test.js new-code1-cf/test/bagian-template.test.js new-code1-cf/test/bagian-jadwal-template.test.js
git commit -m "feat(bagian): shell empat menu, ringkasan, bottom nav, dan FAB"
```

---

### Task 3: Jadwal split workspace + panel detail bersama

**Files:**
- Modify: `new-code1-cf/public/bagian.html`
- Modify: `new-code1-cf/test/bagian-jadwal-template.test.js`
- Modify: `new-code1-cf/test/bagian-workspace-v2.test.js`

**Interfaces:**
- Consumes: state Task 2, `BagianState.buildJadwalItems`, `groupFullyScheduled`, `unscheduledPeserta`, `matchesQuery`, `sortByDate`.
- Produces: computed `jadwalPendingGroups`, `jadwalItems`, `visibleJadwalItems`, `jadwalFormGroup`; methods `selectItem(kind, key)`, `closeDetail()`, `startJadwalForGroup(key)`, `startFirstPendingJadwal()`; markup `.ws-detail` dengan detail jadwal + form.

- [ ] **Step 1: Tambahkan test yang gagal**

Tambahkan ke `new-code1-cf/test/bagian-workspace-v2.test.js`:

```js
describe('bagian workspace v2 — jadwal', () => {
  it('memakai split workspace dan panel detail bersama', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('workspace--split');
    expect(html).toContain('class="ws-detail"');
    expect(html).toContain('detail-back');
    expect(html).toContain('visibleJadwalItems');
    expect(html).toContain('selectItem(item.kind, item.key)');
  });

  it('menyediakan aksi dan form jadwal di panel detail', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('startJadwalForGroup');
    expect(html).toContain('jadwalFormGroup');
    expect(html).toContain('startFirstPendingJadwal');
    expect(html).toContain('Buat Jadwal');
    expect(html).toContain('Simpan Jadwal');
  });

  it('menampilkan sisa peserta yang belum terjadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('jadwalPendingGroups');
    expect(html).toContain('unscheduledPeserta');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-workspace-v2.test.js`
Expected: FAIL — `workspace--split`, `visibleJadwalItems`, `startJadwalForGroup` belum ada.

- [ ] **Step 3: Ganti kartu Jadwal lama dengan daftar split**

Ganti seluruh blok dari `<!-- ===== TAB: JADWAL ===== -->` sampai tepat sebelum `<!-- ===== UPLOAD BERITA ACARA ===== -->` dengan:

```html
                    <!-- ===== TAB: JADWAL ===== -->
                    <section v-if="activeTab==='jadwal'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div class="flex items-center gap-3 border-b border-slate-100 p-4">
                            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><i class="bi bi-calendar-plus"></i></div>
                            <div class="min-w-0 flex-1">
                                <h2 class="text-base font-bold text-slate-900">Jadwal Pelaksanaan</h2>
                                <p class="text-xs text-slate-400">{{ jadwalList.length }} jadwal aktif · {{ jadwalPendingGroups.length }} perlu dijadwalkan</p>
                            </div>
                            <button type="button" class="btn-soft !py-2 text-xs" @click="startFirstPendingJadwal"><i class="bi bi-plus-circle"></i> Buat Jadwal</button>
                        </div>
                        <div class="border-b border-slate-100 p-3">
                            <input v-model="q" type="search" class="input" placeholder="Cari kegiatan, dosen, peserta...">
                            <div class="mt-2 flex flex-wrap gap-2">
                                <button type="button" class="chip" :class="jadwalFilter==='semua' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="jadwalFilter='semua'">Semua</button>
                                <button type="button" class="chip" :class="jadwalFilter==='belum' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="jadwalFilter='belum'">Belum dijadwalkan</button>
                                <button type="button" class="chip" :class="jadwalFilter==='sudah' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="jadwalFilter='sudah'">Sudah dijadwalkan</button>
                            </div>
                        </div>
                        <div v-if="!visibleJadwalItems.length" class="p-8 text-center">
                            <i class="bi bi-calendar-x mb-2 block text-4xl text-slate-300"></i>
                            <p class="text-sm text-slate-500">Belum ada kegiatan ACC untuk dijadwalkan.</p>
                        </div>
                        <div v-else class="divide-y divide-slate-50">
                            <button v-for="item in visibleJadwalItems" :key="item.id" type="button" class="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50" :class="sel.kind===item.kind && sel.key===item.key ? 'bg-brand-50/60' : ''" @click="selectItem(item.kind, item.key)">
                                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="item.kind==='jadwal' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'">
                                    <i class="bi" :class="item.kind==='jadwal' ? 'bi-calendar-check' : 'bi-calendar-plus'"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="truncate text-sm font-bold text-slate-900">{{ item.nama }}</div>
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                        <span class="flex items-center gap-1"><i class="bi bi-grid"></i>Blok {{ item.blok }}</span>
                                        <span v-if="item.tanggal" class="flex items-center gap-1"><i class="bi bi-calendar3"></i>{{ formatTanggal(item.tanggal) }}</span>
                                        <span v-if="item.jadwal && item.jadwal.Jam" class="flex items-center gap-1"><i class="bi bi-clock"></i>{{ item.jadwal.Jam }}</span>
                                        <span v-if="item.dosen" class="flex items-center gap-1"><i class="bi bi-person-badge"></i>{{ item.dosen }}</span>
                                    </div>
                                </div>
                                <div class="flex shrink-0 flex-col items-end gap-1">
                                    <span class="chip" :class="statusBadgeClass(item.status)">{{ statusLabel(item.status) }}</span>
                                    <span class="text-[11px] text-slate-400">{{ item.peserta.length }} peserta</span>
                                </div>
                            </button>
                        </div>
                    </section>
```

- [ ] **Step 4: Isi panel detail bersama untuk jadwal**

Ganti placeholder `<aside>` dari Task 2 dengan:

```html
                        <aside class="ws-detail" :class="{ 'is-open': mobileDetail }" role="dialog" aria-modal="true" aria-label="Detail kegiatan">
                            <div v-if="!selectedItem" class="rounded-2xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-100">
                                <i class="bi bi-layout-sidebar-inset mb-2 block text-3xl text-slate-300"></i>
                                <p class="text-sm text-slate-500">Pilih kegiatan untuk melihat detail.</p>
                            </div>
                            <div v-else class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                                <div class="detail-bar">
                                    <button type="button" class="detail-back" aria-label="Kembali" @click="closeDetail"><i class="bi bi-arrow-left"></i></button>
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate text-base font-bold text-slate-900">{{ selectedItem.nama }}</div>
                                        <div class="text-[11px] text-slate-400">Blok {{ selectedItem.blok }}<template v-if="selectedItem.tanggal"> · {{ formatTanggal(selectedItem.tanggal) }}</template></div>
                                    </div>
                                    <span class="chip shrink-0" :class="statusBadgeClass(selectedItem.status)">{{ statusLabel(selectedItem.status) }}</span>
                                </div>
                                <div class="flex items-center gap-1 border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-wide">
                                    <span :class="selectedItem.status==='acc' ? 'text-brand-600' : 'text-emerald-600'">ACC</span>
                                    <i class="bi bi-chevron-right text-slate-300"></i>
                                    <span :class="selectedItem.status!=='acc' ? 'text-brand-600' : 'text-slate-300'">Jadwal</span>
                                    <i class="bi bi-chevron-right text-slate-300"></i>
                                    <span :class="(selectedItem.status==='draft' || selectedItem.status==='selesai') ? 'text-brand-600' : 'text-slate-300'">Berita Acara</span>
                                </div>
                                <div class="p-4" @input="markFormDirty" @change="markFormDirty">
                                    <!-- detail: jadwal start -->
                                    <div v-if="jadwal.open" class="space-y-4">
                                        <div v-if="jadwalFormGroup" class="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm"><i class="bi bi-journal-check"></i></div>
                                            <div class="min-w-0 flex-1">
                                                <div class="text-sm font-bold text-slate-900">{{ jadwalFormGroup.nama || jadwalFormGroup.label }}</div>
                                                <div class="text-[11px] text-slate-400">{{ jadwalFormGroup.peserta.length }} peserta</div>
                                            </div>
                                        </div>
                                        <div v-else class="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Pilih kegiatan terlebih dahulu.</div>
                                        <template v-if="jadwalFormGroup">
                                            <div>
                                                <div class="mb-2 flex items-center justify-between">
                                                    <span class="text-xs font-bold uppercase tracking-wide text-slate-400">Pilih Peserta</span>
                                                    <button type="button" class="text-xs font-semibold text-brand-600" @click="toggleAllJadwalPeserta">{{ jadwalAllSelected ? 'Hapus Semua' : 'Pilih Semua' }}</button>
                                                </div>
                                                <div class="space-y-2">
                                                    <label v-for="p in jadwalFormGroup.peserta" :key="p.idPengajuan" class="flex items-center gap-3 rounded-xl border p-3 transition" :class="jadwal.selected[p.idPengajuan] ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white'">
                                                        <input type="checkbox" class="h-4 w-4 accent-indigo-600" :checked="!!jadwal.selected[p.idPengajuan]" @change="toggleJadwalPeserta(p.idPengajuan)">
                                                        <div class="min-w-0 flex-1">
                                                            <div class="truncate text-sm font-semibold text-slate-800">{{ p.namaLengkap }}</div>
                                                            <div class="font-mono text-[11px] text-slate-400">NPM {{ p.npm }}</div>
                                                        </div>
                                                    </label>
                                                </div>
                                                <p class="mt-2 text-[11px] text-slate-400">Terpilih: {{ jadwalSelectedList().length }} peserta</p>
                                            </div>
                                            <div class="space-y-4">
                                                <div><label class="label">Tanggal Pelaksanaan</label><input v-model="jadwal.tanggal" type="date" class="input"></div>
                                                <div><label class="label">Jam</label><input v-model="jadwal.jam" type="time" class="input"></div>
                                                <div class="relative">
                                                    <label class="label">Dosen</label>
                                                    <input v-model="jadwal.dosen" class="input" placeholder="Ketik nama dosen..." autocomplete="off" @input="dosenPick.jadwal = true" @blur="dosenPick.jadwal = false">
                                                    <div v-if="dosenPick.jadwal && dosenSuggest(jadwal.dosen).length" class="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lift">
                                                        <button v-for="d in dosenSuggest(jadwal.dosen)" :key="d" type="button" class="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-brand-50" @mousedown.prevent="pickDosen(jadwal, d)">{{ d }}</button>
                                                    </div>
                                                </div>
                                                <div><label class="label">Catatan (Opsional)</label><input v-model="jadwal.catatan" class="input" placeholder="opsional"></div>
                                            </div>
                                            <div class="flex gap-3">
                                                <button type="button" class="btn-soft flex-1" @click="closeDetail">Batal</button>
                                                <button type="button" class="btn-primary flex-1" :disabled="loading" @click="saveJadwal"><i class="bi bi-save"></i> {{ jadwal.editingId ? 'Simpan Perubahan' : 'Simpan Jadwal' }}</button>
                                            </div>
                                        </template>
                                    </div>
                                    <div v-else-if="selectedItem.kind==='jadwal'" class="space-y-4">
                                        <div class="rounded-2xl bg-slate-50 p-4">
                                            <div class="grid grid-cols-2 gap-3">
                                                <div><div class="label">Tanggal</div><div class="value">{{ formatTanggal(selectedItem.jadwal.Tanggal) }}</div></div>
                                                <div><div class="label">Jam</div><div class="value">{{ selectedItem.jadwal.Jam || '-' }}</div></div>
                                                <div class="col-span-2"><div class="label">Dosen</div><div class="value">{{ selectedItem.jadwal.Dosen || '-' }}</div></div>
                                                <div v-if="selectedItem.jadwal.Catatan" class="col-span-2"><div class="label">Catatan</div><div class="value">{{ selectedItem.jadwal.Catatan }}</div></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="section-title !mb-2"><i class="bi bi-people"></i> Peserta ({{ selectedItem.peserta.length }})</div>
                                            <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                                <div v-for="p in selectedItem.peserta" :key="p.idPengajuan" class="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-100">
                                                    <div class="min-w-0"><div class="truncate text-xs font-semibold text-slate-800">{{ p.namaLengkap }}</div><div class="font-mono text-[10px] text-slate-400">NPM {{ p.npm }}</div></div>
                                                    <span class="chip shrink-0" :class="statusBadge(p.statusPengajuan)">{{ p.statusPengajuan }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <button v-if="!selectedItem.ba" type="button" class="btn-primary !py-2 text-xs" @click="goCreateBa(selectedItem.blok, selectedItem.nama)"><i class="bi bi-file-earmark-plus"></i> Buat BA</button>
                                            <button v-else-if="!selectedItem.ba.selesai" type="button" class="btn-primary !py-2 text-xs" @click="selectItem('ba', selectedItem.ba['BA ID'])"><i class="bi bi-pencil"></i> Lengkapi BA</button>
                                            <button v-else type="button" class="btn-soft !py-2 text-xs" @click="selectItem('ba', selectedItem.ba['BA ID'])"><i class="bi bi-eye"></i> Lihat BA</button>
                                            <button type="button" class="btn-soft !py-2 text-xs" @click="editJadwal(selectedItem.key)"><i class="bi bi-pencil"></i> Edit</button>
                                            <button type="button" class="btn-soft !py-2 text-xs text-rose-600" @click="cancelJadwal(selectedItem.key)"><i class="bi bi-x-circle"></i> Batalkan</button>
                                        </div>
                                    </div>
                                    <!-- detail: jadwal end -->
                                </div>
                            </div>
                        </aside>
```

- [ ] **Step 5: Tambahkan computed dan method jadwal**

Di `computed`, tambahkan:

```js
                jadwalPendingGroups() {
                    const B = window.BagianState;
                    return this.kegiatanGroups
                        .filter(function (g) { return !B.groupFullyScheduled(g, this.jadwalList); }.bind(this))
                        .map(function (g) {
                            return Object.assign({}, g, {
                                nama: B.kegiatanName(g),
                                peserta: B.unscheduledPeserta(g, this.jadwalList)
                            });
                        })
                        .filter(function (g) { return g.peserta.length > 0; });
                },
                jadwalItems() {
                    return window.BagianState.buildJadwalItems(this.kegiatanGroups, this.jadwalList, this.baList);
                },
                visibleJadwalItems() {
                    const B = window.BagianState;
                    let list = this.jadwalItems;
                    if (this.jadwalFilter === 'belum') list = list.filter(function (i) { return i.kind === 'group'; });
                    else if (this.jadwalFilter === 'sudah') list = list.filter(function (i) { return i.kind === 'jadwal'; });
                    list = list.filter(function (i) { return B.matchesQuery(i, this.q); }.bind(this));
                    return B.sortByDate(list.filter(function (i) { return i.kind === 'group'; }), 'asc')
                        .concat(B.sortByDate(list.filter(function (i) { return i.kind === 'jadwal'; }), 'desc'));
                },
                jadwalFormGroup() {
                    const key = this.jadwal.kegiatanKey;
                    if (!key) return null;
                    const source = this.jadwal.editingId ? this.jadwalKegiatanGroups : this.jadwalPendingGroups;
                    return source.find(function (g) { return g.key === key; }.bind(this))
                        || this.jadwalSelectedGroup;
                },
```

Ubah `kegiatanGroups` agar memakai helper dan label tanpa "Blok":

```js
                kegiatanGroups() {
                    return window.BagianState.buildKegiatanGroups(this.rows, {
                        statuses: this.baConfig.statuses || ['ACC'],
                        finalOnly: this.baConfig.finalOnly !== false
                    });
                },
```

Ubah `jadwalKegiatanGroups` agar memakai seluruh grup:

```js
                jadwalKegiatanGroups() {
                    return this.allKegiatanGroups;
                },
```

Ubah `jadwalSelectedList`, `jadwalAllSelected`, `toggleAllJadwalPeserta` agar memakai `jadwalFormGroup`:

```js
                jadwalSelectedList() {
                    const g = this.jadwalFormGroup;
                    if (!g) return [];
                    return g.peserta.filter(function (p) { return !!this.jadwal.selected[p.idPengajuan]; }.bind(this));
                },
                jadwalAllSelected() {
                    const g = this.jadwalFormGroup;
                    if (!g) return false;
                    return g.peserta.length > 0 && g.peserta.every(function (p) { return !!this.jadwal.selected[p.idPengajuan]; }.bind(this));
                },
                toggleAllJadwalPeserta() {
                    const g = this.jadwalFormGroup;
                    if (!g) return;
                    const target = !this.jadwalAllSelected;
                    g.peserta.forEach(function (p) { this.jadwal.selected[p.idPengajuan] = target; }.bind(this));
                },
```

Di `methods`, tambahkan:

```js
                selectItem(kind, key) {
                    this.sel = { kind: kind, key: key };
                    this.mobileDetail = true;
                    this.formDirty = false;
                    if (kind === 'group') this.startJadwalForGroup(key);
                    if (kind === 'jadwal' || kind === 'ba') {
                        this.jadwal.open = false;
                        this.ba.open = false;
                    }
                    if (kind === 'ba') this.editDraftBaById(key);
                },
                closeDetail() {
                    this.sel = { kind: '', key: '' };
                    this.mobileDetail = false;
                    this.formDirty = false;
                    this.jadwal.open = false;
                    this.ba.open = false;
                    this.ba.lengkapi = null;
                },
                startJadwalForGroup(key) {
                    const g = this.jadwalPendingGroups.find(function (x) { return x.key === key; })
                        || this.jadwalKegiatanGroups.find(function (x) { return x.key === key; });
                    if (!g) return;
                    const selected = {};
                    g.peserta.forEach(function (p) { selected[p.idPengajuan] = true; });
                    this.jadwal = {
                        open: true, editingId: null, kegiatanKey: key,
                        tanggal: this.dateOnly(g.tanggal), jam: '', dosen: '', catatan: '', selected: selected
                    };
                },
                startFirstPendingJadwal() {
                    const first = this.visibleJadwalItems.find(function (i) { return i.kind === 'group'; });
                    if (first) this.selectItem('group', first.key);
                },
```

Ubah `editJadwal(id)` menjadi:

```js
                editJadwal(id) {
                    const j = this.jadwalList.find(function (x) { return x.JadwalID === id; });
                    if (!j) return;
                    const g = this.jadwalKegiatanGroups.find(function (x) {
                        return x.blok === j.Blok && (x.pilihan + (x.detail ? ' - ' + x.detail : '')) === j.NamaKegiatan;
                    }) || null;
                    const selected = {};
                    (j.peserta || []).forEach(function (p) { selected[p.idPengajuan] = true; });
                    this.jadwal = {
                        open: true, editingId: j.JadwalID, kegiatanKey: g ? g.key : null,
                        tanggal: this.dateOnly(j.Tanggal), jam: j.Jam, dosen: j.Dosen, catatan: j.Catatan, selected: selected
                    };
                    this.sel = { kind: 'jadwal', key: j.JadwalID };
                    this.mobileDetail = true;
                    this.formDirty = false;
                },
```

Ubah `saveJadwal` agar memakai `jadwalFormGroup`:

```js
                async saveJadwal() {
                    const g = this.jadwalFormGroup;
                    if (!g) { this.showToast('Pilih kegiatan terlebih dahulu.', 'error'); return; }
                    const list = this.jadwalSelectedList();
                    if (!list.length) { this.showToast('Pilih minimal satu peserta.', 'error'); return; }
                    if (!this.jadwal.tanggal) { this.showToast('Isi tanggal pelaksanaan terlebih dahulu.', 'error'); return; }
                    this.loading = true;
                    try {
                        const payload = {
                            bagian: this.subBagian || this.kategori,
                            blok: g.blok,
                            namaKegiatan: g.pilihan + (g.detail ? ' - ' + g.detail : ''),
                            tanggal: this.jadwal.tanggal, jam: this.jadwal.jam, dosen: this.jadwal.dosen, catatan: this.jadwal.catatan.trim(),
                            peserta: list
                        };
                        const res = this.jadwal.editingId
                            ? await this.run('updateJadwalPelaksanaan', this.jadwal.editingId, payload, this.kategori)
                            : await this.run('saveJadwalPelaksanaan', payload, this.kategori);
                        this.showToast(res.message, res.success ? 'success' : 'error');
                        if (res.success) {
                            this.closeDetail();
                            await this.loadData();
                        }
                    } catch (e) {
                        this.showToast('Gagal: ' + e, 'error');
                    } finally {
                        this.loading = false;
                    }
                },
```

- [ ] **Step 6: Perbarui test lama yang memeriksa computed jadwal**

Di `new-code1-cf/test/bagian-jadwal-template.test.js`, ganti test "mengikat this pada callback computed jadwal":

```js
  it('mengikat this pada callback computed jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('g.key === this.jadwal.kegiatanKey; }.bind(this)');
  });
```

menjadi:

```js
  it('memakai helper jadwalFormGroup untuk form jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('jadwalFormGroup');
    expect(html).toContain('jadwalPendingGroups');
  });
```

- [ ] **Step 7: Jalankan test, pastikan lulus**

Run:

```bash
cd /workspace/new-code1-cf
npx vitest run test/bagian-workspace-v2.test.js test/bagian-jadwal-template.test.js test/bagian-template.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /workspace
git add new-code1-cf/public/bagian.html new-code1-cf/test/bagian-workspace-v2.test.js new-code1-cf/test/bagian-jadwal-template.test.js
git commit -m "feat(bagian): jadwal split workspace dan panel detail"
```

---

### Task 4: Berita Acara — antrean kerja + form inline

**Files:**
- Modify: `new-code1-cf/public/bagian.html`
- Modify: `new-code1-cf/test/bagian-workspace-v2.test.js`

**Interfaces:**
- Consumes: `BagianState.buildBaWorkItems`, `matchesQuery`, `sortByDate`; state `baTabFilter`, `ba.lengkapi`.
- Produces: computed `baWorkItems`, `visibleBaItems`; methods `goCreateBa(blok, nama)`, `openBaForGroup(g)`, `openBaForGroupByKey(key)`, `editDraftBa(r)`, `editDraftBaById(id)`, `saveDraftBa()`; markup antrean BA + form baru + form draft inline.

- [ ] **Step 1: Tambahkan test yang gagal**

Tambahkan ke `new-code1-cf/test/bagian-workspace-v2.test.js`:

```js
describe('bagian workspace v2 — berita acara', () => {
  it('menampilkan antrean BA tanpa BA selesai', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('baWorkItems');
    expect(html).toContain('visibleBaItems');
    expect(html).toContain("baTabFilter==='draft'");
    expect(html).toContain('Belum dibuat');
  });

  it('menyediakan aksi Buat BA dan Lengkapi', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('goCreateBa');
    expect(html).toContain('Lengkapi');
    expect(html).toContain('saveDraftBa');
    expect(html).toContain('editDraftBa');
  });

  it('menghapus modal lengkapi lama dan merender form draft inline', async () => {
    const html = await loadBagianHtml();
    expect(html).not.toContain('<!-- ===== LENGKAPI DRAFT BA ===== -->');
    expect(html).not.toContain('lengkapiDraft(');
    expect(html).toContain('Simpan &amp; Lengkapi');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-workspace-v2.test.js`
Expected: FAIL — `visibleBaItems`, `saveDraftBa`, modal lama masih ada.

- [ ] **Step 3: Ganti kartu BA lama + draft lama dengan antrean kerja**

Ganti seluruh blok dari `<!-- ===== UPLOAD BERITA ACARA ===== -->` sampai tepat sebelum `<!-- ===== DAFTAR BERITA ACARA ===== -->` dengan:

```html
                    <!-- ===== ANTREAN BERITA ACARA ===== -->
                    <section v-if="activeTab==='ba'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div class="flex items-center gap-3 border-b border-slate-100 p-4">
                            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><i class="bi bi-file-earmark-text"></i></div>
                            <div class="min-w-0 flex-1">
                                <h2 class="text-base font-bold text-slate-900">Berita Acara</h2>
                                <p class="text-xs text-slate-400">{{ baWorkItems.length }} kegiatan dalam antrean</p>
                            </div>
                        </div>
                        <div class="border-b border-slate-100 p-3">
                            <input v-model="q" type="search" class="input" placeholder="Cari kegiatan, dosen, peserta...">
                            <div class="mt-2 flex flex-wrap gap-2">
                                <button type="button" class="chip" :class="baTabFilter==='semua' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="baTabFilter='semua'">Semua</button>
                                <button type="button" class="chip" :class="baTabFilter==='belum' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="baTabFilter='belum'">Belum dibuat</button>
                                <button type="button" class="chip" :class="baTabFilter==='draft' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="baTabFilter='draft'">Draft</button>
                                <template v-if="fBlok">
                                    <button type="button" class="chip bg-brand-50 text-brand-700" @click="fBlok=''">Blok {{ fBlok }} ×</button>
                                </template>
                            </div>
                        </div>
                        <div v-if="!visibleBaItems.length" class="p-8 text-center">
                            <i class="bi bi-check2-circle mb-2 block text-4xl text-emerald-300"></i>
                            <p class="text-sm text-slate-500">Semua BA sudah lengkap.</p>
                        </div>
                        <div v-else class="divide-y divide-slate-50">
                            <button v-for="item in visibleBaItems" :key="item.id" type="button" class="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50" :class="sel.kind===item.kind && sel.key===item.key ? 'bg-brand-50/60' : ''" @click="selectItem(item.kind, item.key)">
                                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="item.kind==='ba' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'">
                                    <i class="bi" :class="item.kind==='ba' ? 'bi-hourglass-split' : 'bi-file-earmark-plus'"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="truncate text-sm font-bold text-slate-900">{{ item.nama }}</div>
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                        <span class="flex items-center gap-1"><i class="bi bi-grid"></i>Blok {{ item.blok }}</span>
                                        <span v-if="item.tanggal" class="flex items-center gap-1"><i class="bi bi-calendar3"></i>{{ formatTanggal(item.tanggal) }}</span>
                                        <span class="flex items-center gap-1"><i class="bi bi-people"></i>{{ item.peserta.length }} peserta</span>
                                    </div>
                                    <div v-if="item.kind==='ba' && item.jadwal" class="mt-1 text-[11px] text-slate-400">Dari jadwal {{ item.jadwal.JadwalID }}</div>
                                </div>
                                <div class="flex shrink-0 flex-col items-end gap-1">
                                    <span class="chip" :class="statusBadgeClass(item.status)">{{ item.status==='draft' ? 'Draft' : statusLabel(item.status) }}</span>
                                    <span class="text-[11px] font-semibold text-brand-600">{{ item.kind==='ba' ? 'Lengkapi' : 'Buat BA' }}</span>
                                </div>
                            </button>
                        </div>
                    </section>
```

- [ ] **Step 4: Tambahkan computed antrean BA**

Di `computed`, ganti `baWorkItems` sementara dengan:

```js
                baWorkItems() {
                    return window.BagianState.buildBaWorkItems(this.kegiatanGroups, this.draftBaList, this.jadwalList);
                },
                visibleBaItems() {
                    const B = window.BagianState;
                    let list = this.baWorkItems;
                    if (this.baTabFilter === 'belum') list = list.filter(function (i) { return i.kind === 'group'; });
                    else if (this.baTabFilter === 'draft') list = list.filter(function (i) { return i.kind === 'ba'; });
                    if (this.fBlok) {
                        list = list.filter(function (i) { return String(i.blok || '').trim() === String(this.fBlok).trim(); }.bind(this));
                    }
                    list = list.filter(function (i) { return B.matchesQuery(i, this.q); }.bind(this));
                    return B.sortByDate(list.filter(function (i) { return i.kind === 'ba'; }), 'desc')
                        .concat(B.sortByDate(list.filter(function (i) { return i.kind === 'group'; }), 'asc'));
                },
```

- [ ] **Step 5: Tambahkan method aksi BA**

Di `methods`, tambahkan:

```js
                openBaForGroup(g) {
                    if (!g) return;
                    const jadwal = window.BagianState.jadwalForKegiatan(
                        { blok: g.blok, nama: window.BagianState.kegiatanName(g), tanggal: g.tanggal },
                        this.jadwalList
                    );
                    if (jadwal) {
                        this.openBaFromJadwal(jadwal);
                    } else {
                        this.openBaPicker();
                        this.ba.kegiatanKey = g.key;
                        this.ba.tanggal = this.dateOnly(g.tanggal);
                    }
                    this.sel = { kind: 'group', key: g.key };
                    this.mobileDetail = true;
                    this.formDirty = false;
                },
                openBaForGroupByKey(key) {
                    const g = this.kegiatanGroups.find(function (x) { return x.key === key; });
                    if (g) this.openBaForGroup(g);
                },
                goCreateBa(blok, nama) {
                    this.setTab('ba', { filter: 'belum' });
                    const target = this.visibleBaItems.find(function (i) {
                        return i.kind === 'group'
                            && window.BagianState.sameKegiatan(i.blok, i.nama, blok, nama);
                    });
                    if (target) this.selectItem('group', target.key);
                },
                editDraftBa(r) {
                    if (!r) return;
                    this.ba.lengkapi = {
                        id: r['BA ID'],
                        dosen: r.Dosen || '',
                        jam: r.Jam || '',
                        tanggal: this.dateOnly(r['Tanggal Pelaksanaan'])
                    };
                    this.ba.open = false;
                    this.jadwal.open = false;
                    this.formDirty = false;
                },
                editDraftBaById(id) {
                    const item = (this.baWorkItems || []).find(function (i) { return i.kind === 'ba' && i.key === id; })
                        || (this.riwayatItems || []).find(function (i) { return i.kind === 'ba' && i.key === id; });
                    if (item && !item.ba.selesai) this.editDraftBa(item.ba);
                },
                async saveDraftBa() {
                    if (!this.ba.lengkapi) return;
                    const d = this.ba.lengkapi;
                    if (!d.dosen || !d.jam || !d.tanggal) {
                        this.showToast('Lengkapi dosen, jam, dan tanggal terlebih dahulu.', 'error');
                        return;
                    }
                    this.loading = true;
                    try {
                        const payload = { dosen: d.dosen, jam: d.jam, tanggal: d.tanggal };
                        const res = await this.run('lengkapiBeritaAcaraBagian', d.id, payload, this.kategori);
                        this.showToast(res.message, res.success ? 'success' : 'error');
                        if (res.success) {
                            this.closeDetail();
                            await this.loadData();
                        }
                    } catch (e) {
                        this.showToast('Gagal: ' + e, 'error');
                    } finally {
                        this.loading = false;
                    }
                },
```

- [ ] **Step 6: Sisipkan form BA dan draft di panel detail**

Di dalam `<div class="p-4" @input="markFormDirty" @change="markFormDirty">`, ganti `<!-- detail: jadwal end -->` dengan:

```html
                                    <!-- detail: jadwal end -->
                                    <!-- detail: ba start -->
                                    <div v-if="selectedItem.kind==='ba' && !selectedItem.ba.selesai" class="space-y-4">
                                        <div class="rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
                                            <div class="font-bold">Draft Berita Acara</div>
                                            <div class="mt-1">Lengkapi dosen, jam, dan tanggal agar BA pindah ke Riwayat.</div>
                                            <div class="mt-1 font-mono text-[10px] text-amber-700">{{ selectedItem.ba['BA ID'] }}</div>
                                        </div>
                                        <a v-if="selectedItem.ba['File URL']" :href="safeUrl(selectedItem.ba['File URL'])" target="_blank" rel="noopener noreferrer" class="link inline-block text-xs"><i class="bi bi-eye"></i> Lihat file BA</a>
                                        <div class="space-y-4">
                                            <div class="relative">
                                                <label class="label">Dosen</label>
                                                <input v-model="ba.lengkapi.dosen" class="input" placeholder="Ketik nama dosen..." autocomplete="off" @input="dosenPick.lengkapi = true" @blur="dosenPick.lengkapi = false">
                                                <div v-if="dosenPick.lengkapi && dosenSuggest(ba.lengkapi.dosen).length" class="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lift">
                                                    <button v-for="d in dosenSuggest(ba.lengkapi.dosen)" :key="d" type="button" class="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-brand-50" @mousedown.prevent="pickDosen(ba.lengkapi, d)">{{ d }}</button>
                                                </div>
                                            </div>
                                            <div><label class="label">Jam</label><input v-model="ba.lengkapi.jam" type="time" class="input"></div>
                                            <div><label class="label">Tanggal</label><input v-model="ba.lengkapi.tanggal" type="date" class="input"></div>
                                        </div>
                                        <div v-if="selectedItem.peserta.length" class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                            <div v-for="p in selectedItem.peserta" :key="p.npm + p.namaLengkap" class="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-100">
                                                <div class="min-w-0"><div class="truncate text-xs font-semibold text-slate-800">{{ p.namaLengkap }}</div><div class="font-mono text-[10px] text-slate-400">NPM {{ p.npm }}</div></div>
                                            </div>
                                        </div>
                                        <div class="flex gap-3">
                                            <button type="button" class="btn-soft flex-1" @click="closeDetail">Batal</button>
                                            <button type="button" class="btn-primary flex-1" :disabled="loading" @click="saveDraftBa"><i class="bi bi-check-lg"></i> Simpan &amp; Lengkapi</button>
                                        </div>
                                    </div>
                                    <div v-if="selectedItem.kind==='ba' && selectedItem.ba.selesai" class="space-y-4">
                                        <div class="rounded-2xl bg-slate-50 p-4">
                                            <div class="grid grid-cols-2 gap-3">
                                                <div><div class="label">Tanggal</div><div class="value">{{ formatTanggal(selectedItem.ba['Tanggal Pelaksanaan']) }}</div></div>
                                                <div><div class="label">Jam</div><div class="value">{{ selectedItem.ba.Jam || '-' }}</div></div>
                                                <div class="col-span-2"><div class="label">Dosen</div><div class="value">{{ selectedItem.ba.Dosen || '-' }}</div></div>
                                                <div v-if="selectedItem.ba.Label" class="col-span-2"><div class="label">Label</div><div class="value">{{ selectedItem.ba.Label }}</div></div>
                                                <div v-if="selectedItem.ba.Catatan" class="col-span-2"><div class="label">Catatan</div><div class="value">{{ selectedItem.ba.Catatan }}</div></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="section-title !mb-2"><i class="bi bi-people"></i> Peserta ({{ selectedItem.peserta.length }})</div>
                                            <div class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                                <div v-for="p in selectedItem.peserta" :key="p.npm + p.namaLengkap" class="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-100">
                                                    <div class="min-w-0"><div class="truncate text-xs font-semibold text-slate-800">{{ p.namaLengkap }}</div><div class="font-mono text-[10px] text-slate-400">NPM {{ p.npm }}</div></div>
                                                </div>
                                            </div>
                                        </div>
                                        <a v-if="selectedItem.ba['File URL']" :href="safeUrl(selectedItem.ba['File URL'])" target="_blank" rel="noopener noreferrer" class="btn-soft w-full !py-2 text-xs"><i class="bi bi-file-earmark-pdf"></i> Buka File BA</a>
                                    </div>
                                    <div v-if="selectedItem.kind==='group' && activeTab==='ba'" class="space-y-4">
                                        <div class="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm"><i class="bi bi-journal-check"></i></div>
                                            <div class="min-w-0 flex-1">
                                                <div class="text-sm font-bold text-slate-900">{{ selectedItem.nama }}</div>
                                                <div class="text-[11px] text-slate-400">{{ selectedItem.peserta.length }} peserta</div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="mb-2 flex items-center justify-between">
                                                <span class="text-xs font-bold uppercase tracking-wide text-slate-400">Pilih Peserta</span>
                                                <button type="button" class="text-xs font-semibold text-brand-600" @click="toggleAllPeserta">{{ allSelected ? 'Hapus Semua' : 'Pilih Semua' }}</button>
                                            </div>
                                            <div class="space-y-2">
                                                <label v-for="p in selectedGroup.peserta" :key="p.idPengajuan" class="flex items-center gap-3 rounded-xl border p-3 transition" :class="ba.selected[p.idPengajuan] ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white'">
                                                    <input type="checkbox" class="h-4 w-4 accent-indigo-600" :checked="!!ba.selected[p.idPengajuan]" @change="togglePeserta(p.idPengajuan)">
                                                    <div class="min-w-0 flex-1">
                                                        <div class="truncate text-sm font-semibold text-slate-800">{{ p.namaLengkap }}</div>
                                                        <div class="font-mono text-[11px] text-slate-400">NPM {{ p.npm }}</div>
                                                    </div>
                                                </label>
                                            </div>
                                            <p class="mt-2 text-[11px] text-slate-400">Terpilih: {{ selectedCount }} peserta</p>
                                        </div>
                                        <div class="space-y-4">
                                            <div><label class="label">Label <span class="font-normal text-slate-400">(opsional)</span></label><input v-model="ba.label" class="input" placeholder="mis. Sesi 1 / Hari ke-2"></div>
                                            <div v-if="ba.mode==='jadwal'" class="rounded-2xl bg-brand-50 p-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-100"><i class="bi bi-calendar-check mr-1"></i> Dari jadwal {{ ba.jadwalId }}</div>
                                            <div class="relative">
                                                <label class="label">Dosen</label>
                                                <input v-model="ba.dosen" class="input" placeholder="Ketik nama dosen..." autocomplete="off" @input="dosenPick.ba = true" @blur="dosenPick.ba = false">
                                                <div v-if="dosenPick.ba && dosenSuggest(ba.dosen).length" class="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lift">
                                                    <button v-for="d in dosenSuggest(ba.dosen)" :key="d" type="button" class="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-brand-50" @mousedown.prevent="pickDosen(ba, d)">{{ d }}</button>
                                                </div>
                                            </div>
                                            <div><label class="label">Jam</label><input v-model="ba.jam" type="time" class="input"></div>
                                            <div><label class="label">Tanggal Pelaksanaan</label><input v-model="ba.tanggal" type="date" class="input"></div>
                                            <div>
                                                <label class="label">File Berita Acara (PDF)</label>
                                                <div class="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-3">
                                                    <i class="bi bi-cloud-arrow-up text-2xl text-brand-400"></i>
                                                    <div class="min-w-0 flex-1 text-xs text-slate-500">
                                                        <span v-if="ba.fileName" class="font-semibold text-slate-700">{{ ba.fileName }}</span>
                                                        <span v-else>Pilih file PDF atau scan kamera...</span>
                                                    </div>
                                                    <input type="file" accept=".pdf" class="ml-auto w-24 text-[11px] text-transparent" @change="onBaFile">
                                                </div>
                                                <div class="mt-2 flex flex-wrap items-center gap-2">
                                                    <button type="button" class="btn-soft text-xs" :disabled="ba.scanBusy" @click="$refs.scanCamera.click()"><i class="bi bi-camera"></i> Scan Kamera</button>
                                                    <span v-if="ba.scanItems.length" class="text-[11px] text-slate-500">{{ ba.scanItems.length }} halaman</span>
                                                    <button v-if="ba.scanItems.length" type="button" class="btn-primary text-xs" :disabled="ba.scanBusy" @click="buildScanPdf"><i class="bi bi-file-earmark-pdf"></i> Buat PDF</button>
                                                    <button v-if="ba.scanItems.length" type="button" class="btn-soft text-xs" @click="clearScanItems">Bersihkan</button>
                                                </div>
                                                <input ref="scanCamera" type="file" accept="image/*" capture="environment" multiple class="hidden" @change="onScanPhotos">
                                                <div v-if="ba.scanItems.length" class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                                    <div v-for="(it, idx) in ba.scanItems" :key="it.id" class="relative overflow-hidden rounded-lg ring-1 ring-slate-200">
                                                        <img :src="it.url" :alt="'Halaman ' + (idx + 1)" class="h-24 w-full object-cover">
                                                        <span class="absolute left-1 top-1 rounded bg-slate-900/70 px-1.5 text-[10px] font-semibold text-white">{{ idx + 1 }}</span>
                                                        <button type="button" class="absolute right-1 top-1 rounded bg-rose-600/90 px-1.5 text-[10px] font-bold text-white" @click="removeScanItem(idx)">x</button>
                                                        <div class="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-slate-900/60 py-0.5">
                                                            <button type="button" class="rounded px-1 text-[11px] text-white disabled:opacity-30" :disabled="idx === 0" title="Geser ke kiri" @click="moveScanItem(idx, -1)"><i class="bi bi-arrow-left"></i></button>
                                                            <button type="button" class="rounded px-1 text-[11px] text-white disabled:opacity-30" :disabled="idx === ba.scanItems.length - 1" title="Geser ke kanan" @click="moveScanItem(idx, 1)"><i class="bi bi-arrow-right"></i></button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p v-if="ba.scanBusy" class="mt-2 text-[11px] text-brand-600">Memproses gambar...</p>
                                            </div>
                                            <div><label class="label">Catatan (Opsional)</label><input v-model="ba.catatan" class="input" placeholder="opsional"></div>
                                        </div>
                                        <div class="flex gap-3">
                                            <button type="button" class="btn-soft flex-1" @click="closeDetail">Batal</button>
                                            <button type="button" class="btn-primary flex-1" :disabled="loading" @click="submitBa">
                                                <i class="bi bi-upload"></i> Upload
                                            </button>
                                        </div>
                                    </div>
                                    <!-- detail: ba end -->
```

- [ ] **Step 7: Hapus modal Lengkapi Draft lama**

Hapus seluruh blok dari `<!-- ===== LENGKAPI DRAFT BA ===== -->` sampai `</transition>` penutupnya (sekitar baris 618-645).

- [ ] **Step 8: Perbarui `doUploadBa` agar memuat ulang seluruh data**

Ganti `await this.loadBaList();` di `doUploadBa` dengan:

```js
                            await this.loadData();
```

Hapus method `loadBaList()` (sekitar baris 1048-1054) dan method `lengkapiDraft(r)` lama.

- [ ] **Step 9: Jalankan test, pastikan lulus**

Run:

```bash
cd /workspace/new-code1-cf
npx vitest run test/bagian-workspace-v2.test.js test/bagian-template.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd /workspace
git add new-code1-cf/public/bagian.html new-code1-cf/test/bagian-workspace-v2.test.js
git commit -m "feat(bagian): antrean berita acara dan form draft inline"
```

---

### Task 5: Riwayat — arsip BA lengkap + detail read-only

**Files:**
- Modify: `new-code1-cf/public/bagian.html`
- Modify: `new-code1-cf/test/bagian-workspace-v2.test.js`

**Interfaces:**
- Consumes: `BagianState.buildRiwayatItems`, `matchesQuery`; `blokOptions`; `selectItem('ba', id)`.
- Produces: computed `riwayatItems`, `visibleRiwayatItems`; markup tabel desktop + kartu ponsel; detail read-only sudah memakai blok `selectedItem.kind==='ba' && selesai` dari Task 4.

- [ ] **Step 1: Tambahkan test yang gagal**

Tambahkan ke `new-code1-cf/test/bagian-workspace-v2.test.js`:

```js
describe('bagian workspace v2 — riwayat', () => {
  it('menampilkan arsip BA lengkap dengan pencarian dan filter Blok', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('riwayatItems');
    expect(html).toContain('visibleRiwayatItems');
    expect(html).toContain('riwayat-table');
    expect(html).toContain('riwayat-cards');
    expect(html).toContain('blokOptions');
  });

  it('membuka detail read-only dari Riwayat', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain("selectItem('ba', item.key)");
    expect(html).toContain('Buka File BA');
    expect(html).toContain('Belum ada BA lengkap');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-workspace-v2.test.js`
Expected: FAIL — `visibleRiwayatItems`, `riwayat-table` belum ada.

- [ ] **Step 3: Ganti kartu Riwayat lama**

Ganti seluruh blok dari `<!-- ===== DAFTAR BERITA ACARA ===== -->` sampai penutup kartu (sebelum penutup `</div>` workspace), dengan:

```html
                    <!-- ===== RIWAYAT ===== -->
                    <section v-if="activeTab==='riwayat'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div class="flex items-center gap-3 border-b border-slate-100 p-4">
                            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><i class="bi bi-clock-history"></i></div>
                            <div class="min-w-0 flex-1">
                                <h2 class="text-base font-bold text-slate-900">Riwayat Berita Acara</h2>
                                <p class="text-xs text-slate-400">{{ visibleRiwayatItems.length }} BA lengkap</p>
                            </div>
                        </div>
                        <div class="border-b border-slate-100 p-3">
                            <input v-model="q" type="search" class="input" placeholder="Cari kegiatan, dosen, peserta...">
                            <div v-if="blokOptions.length > 1" class="mt-2 flex flex-wrap gap-2">
                                <button type="button" class="chip" :class="fBlok==='' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="fBlok=''">Semua Blok</button>
                                <button v-for="b in blokOptions" :key="b" type="button" class="chip" :class="fBlok===b ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'" @click="fBlok=b">Blok {{ b }}</button>
                            </div>
                        </div>
                        <div v-if="!visibleRiwayatItems.length" class="p-8 text-center">
                            <i class="bi bi-folder2-open mb-2 block text-4xl text-slate-300"></i>
                            <p class="text-sm text-slate-500">Belum ada BA lengkap.</p>
                        </div>
                        <template v-else>
                            <table class="riwayat-table">
                                <thead>
                                    <tr class="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                                        <th class="px-4 py-3">Kegiatan</th>
                                        <th class="px-4 py-3">Blok</th>
                                        <th class="px-4 py-3">Tanggal</th>
                                        <th class="px-4 py-3">Dosen</th>
                                        <th class="px-4 py-3">Peserta</th>
                                        <th class="px-4 py-3">File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="item in visibleRiwayatItems" :key="item.id" class="cursor-pointer border-b border-slate-50 hover:bg-slate-50" @click="selectItem('ba', item.key)">
                                        <td class="px-4 py-3">
                                            <div class="text-sm font-semibold text-slate-900">{{ item.nama }}</div>
                                            <div v-if="item.ba.Label" class="text-[11px] text-slate-400">{{ item.ba.Label }}</div>
                                        </td>
                                        <td class="px-4 py-3 text-xs text-slate-600">Blok {{ item.blok }}</td>
                                        <td class="px-4 py-3 text-xs text-slate-600">{{ formatTanggal(item.tanggal) }}</td>
                                        <td class="px-4 py-3 text-xs text-slate-600">{{ item.dosen || '-' }}</td>
                                        <td class="px-4 py-3 text-xs text-slate-600">{{ item.peserta.length }}</td>
                                        <td class="px-4 py-3">
                                            <a v-if="item.ba['File URL']" :href="safeUrl(item.ba['File URL'])" target="_blank" rel="noopener noreferrer" class="link text-xs" @click.stop><i class="bi bi-file-earmark-pdf"></i> File</a>
                                            <span v-else class="text-xs text-slate-400">-</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div class="riwayat-cards divide-y divide-slate-50">
                                <button v-for="item in visibleRiwayatItems" :key="'c-' + item.id" type="button" class="flex w-full items-start gap-3 p-4 text-left" @click="selectItem('ba', item.key)">
                                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><i class="bi bi-file-earmark-check"></i></div>
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate text-sm font-bold text-slate-900">{{ item.nama }}</div>
                                        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                            <span>Blok {{ item.blok }}</span>
                                            <span>{{ formatTanggal(item.tanggal) }}</span>
                                            <span v-if="item.dosen">{{ item.dosen }}</span>
                                        </div>
                                        <div class="mt-1 text-[11px] text-slate-400">{{ item.peserta.length }} peserta</div>
                                    </div>
                                    <i class="bi bi-chevron-right mt-2 text-slate-300"></i>
                                </button>
                            </div>
                        </template>
                    </section>
```

- [ ] **Step 4: Tambahkan computed Riwayat**

Di `computed`, ganti `riwayatItems` sementara dengan:

```js
                riwayatItems() {
                    return window.BagianState.buildRiwayatItems(this.baList);
                },
                visibleRiwayatItems() {
                    const B = window.BagianState;
                    let list = this.riwayatItems;
                    if (this.fBlok) {
                        list = list.filter(function (i) { return String(i.blok || '').trim() === String(this.fBlok).trim(); }.bind(this));
                    }
                    return list.filter(function (i) { return B.matchesQuery(i, this.q); }.bind(this));
                },
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run:

```bash
cd /workspace/new-code1-cf
npx vitest run test/bagian-workspace-v2.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /workspace
git add new-code1-cf/public/bagian.html new-code1-cf/test/bagian-workspace-v2.test.js
git commit -m "feat(bagian): riwayat BA lengkap dengan detail read-only"
```

---

### Task 6: Guard form, polling, pembersihan kode lama

**Files:**
- Modify: `new-code1-cf/public/bagian.html`
- Modify: `new-code1-cf/test/bagian-workspace-v2.test.js`
- Modify: `new-code1-cf/test/bagian-template.test.js` (bila perlu)

**Interfaces:**
- Consumes: `formDirty`, `hasFormContent`, `confirmDiscard`; `sel`.
- Produces: guard pada `setTab`/`selectItem`/`closeDetail`; `ensureSelection` setelah bootstrap; `silentRefresh` melewati form; penghapusan kode lama.

- [ ] **Step 1: Tambahkan test yang gagal**

Tambahkan ke `new-code1-cf/test/bagian-workspace-v2.test.js`:

```js
describe('bagian workspace v2 — guard dan kebersihan', () => {
  it('menyediakan guard buang perubahan', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('confirmDiscard');
    expect(html).toContain('hasFormContent');
    expect(html).toContain('Perubahan belum disimpan. Tinggalkan?');
  });

  it('polling berhenti saat form terbuka', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('this.jadwal.open');
    expect(html).toContain('this.ba.lengkapi');
    expect(html).not.toContain('loadBaList');
  });

  it('menutup detail yang datanya hilang setelah refresh', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ensureSelection');
    expect(html).toContain('Data sudah diperbarui.');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-workspace-v2.test.js`
Expected: FAIL — `confirmDiscard`, `ensureSelection` belum ada.

- [ ] **Step 3: Tambahkan guard form**

Di `methods`, tambahkan:

```js
                hasFormContent() {
                    return !!(this.formDirty || this.ba.file || (this.ba.scanItems && this.ba.scanItems.length));
                },
                confirmDiscard() {
                    if (!this.hasFormContent()) return true;
                    if (!window.confirm('Perubahan belum disimpan. Tinggalkan?')) return false;
                    this.formDirty = false;
                    return true;
                },
```

Ubah `setTab` agar memanggil guard di awal:

```js
                setTab(t, opts) {
                    if (!this.confirmDiscard()) return;
                    const o = opts || {};
                    ...
```

Ubah `selectItem` agar memanggil guard dan berhenti bila item sama:

```js
                selectItem(kind, key) {
                    if (this.sel.kind === kind && this.sel.key === key) return;
                    if (!this.confirmDiscard()) return;
                    ...
```

Ubah `closeDetail`:

```js
                closeDetail() {
                    if (!this.confirmDiscard()) return;
                    ...
```

- [ ] **Step 4: Perketat polling dan tambahkan `ensureSelection`**

Ubah `silentRefresh`:

```js
                async silentRefresh() {
                    if (!this.loggedIn) { this.stopPolling(); return; }
                    if (this.loading || this.ba.open || this.jadwal.open || this.ba.lengkapi || this.formDirty) return;
                    try {
                        const res = await this._fetchBootstrap();
                        this.applyBootstrap(res);
                    } catch (e) {
                        if (e && e.denied) {
                            this.stopPolling();
                            this.logout();
                        } else if (!this.loggedIn) {
                            this.stopPolling();
                        }
                    }
                },
```

Di `applyBootstrap`, setelah `this.loadBaConfig();`, tambahkan:

```js
                    this.$nextTick(function () { this.ensureSelection(); }.bind(this));
```

Di `methods`, tambahkan:

```js
                resetDetailSilently() {
                    this.sel = { kind: '', key: '' };
                    this.mobileDetail = false;
                    this.jadwal.open = false;
                    this.ba.open = false;
                    this.ba.lengkapi = null;
                    this.formDirty = false;
                },
                ensureSelection() {
                    if (!this.sel.kind) return;
                    if (!this.selectedItem) {
                        this.resetDetailSilently();
                        this.showToast('Data sudah diperbarui.');
                        return;
                    }
                    if (this.sel.kind === 'ba' && this.selectedItem.ba && this.selectedItem.ba.selesai) {
                        this.resetDetailSilently();
                        this.showToast('BA lengkap. Lihat di Riwayat.');
                    }
                },
```

- [ ] **Step 5: Hapus kode lama yang tidak terpakai**

Hapus dari `computed`:

- `filteredRows`
- `filteredBaList`
- `jadwalSiapBaList`
- `riwayatBaList` (digantikan `riwayatItems`)

Hapus dari `data()`:

- `listOpen`
- `filterOpen`

Pertahankan `draftBaList` (dipakai `baWorkItems`).

Hapus dari `methods`:

- `selectJadwalKegiatan`
- `selectKegiatan`
- `backToKegiatanPicker`
- `buatBaDariJadwal` (bila masih ada; pemanggil baru memakai `goCreateBa`)
- `loadBaList`
- `lengkapiDraft` (sudah dihapus Task 4)

Hapus semua referensi ke `Daftar Peserta`, `listOpen`, `filterOpen`, `filteredRows`, `jadwalSiapBaList`, `riwayatBaList`, `filteredBaList` yang tersisa.

Pastikan `logout()` mengembalikan tab dan seleksi:

```js
                    this.activeTab = 'ringkasan';
                    this.sel = { kind: '', key: '' };
                    this.mobileDetail = false;
                    this.q = '';
                    this.formDirty = false;
```

- [ ] **Step 6: Perbarui test lama yang mungkin masih menyebut fitur dihapus**

Run: `cd /workspace/new-code1-cf && npx vitest run test/bagian-template.test.js test/bagian-jadwal-template.test.js test/bagian-workspace-v2.test.js`
Jika ada assertion `filteredRows`/`Daftar Peserta`/`riwayatBaList` yang tersisa, ganti dengan penanda baru (`bagianGroups`/`visibleRiwayatItems`/`riwayatItems`). Jangan menghapus test fitur lain.

- [ ] **Step 7: Jalankan seluruh suite**

Run: `cd /workspace/new-code1-cf && npx vitest run`
Expected: seluruh test PASS (baseline sebelumnya 73 file / 528 test; jumlah baru bertambah).

- [ ] **Step 8: Commit**

```bash
cd /workspace
git add new-code1-cf/public/bagian.html new-code1-cf/test/bagian-workspace-v2.test.js new-code1-cf/test/bagian-template.test.js new-code1-cf/test/bagian-jadwal-template.test.js
git commit -m "chore(bagian): guard form, polling, dan bersihkan kode lama"
```

---

### Task 7: Verifikasi build dan deploy

**Files:**
- Tidak ada perubahan kode baru.

- [ ] **Step 1: Jalankan suite penuh sekali lagi**

Run: `cd /workspace/new-code1-cf && npx vitest run`
Expected: PASS, 0 failure.

- [ ] **Step 2: Deploy Worker**

Run:

```bash
cd /workspace/new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

Expected: deploy sukses; catat versi Worker.

- [ ] **Step 3: Verifikasi live**

Buka `https://inhal-form.<subdomain>.workers.dev/bagian.html?cb=$(date +%s)` (atau URL produksi yang sudah dipakai), lalu cek manual:

- Login kategori.
- Ringkasan menampilkan 4 KPI, Perlu Tindakan, Kelengkapan per Blok, Jadwal Terdekat.
- Jadwal: pilih kegiatan -> form di kanan (desktop), simpan; di ponsel detail penuh + tombol kembali.
- Berita Acara: buat BA draft -> item tetap di antrean dengan badge Draft; lengkapi -> item hilang dan muncul di Riwayat.
- Riwayat: hanya BA lengkap; buka detail read-only dan file.
- Bottom nav 4 item, FAB, guard saat menutup form berisi.
- Tidak ada error konsol.

- [ ] **Step 4: Catat hasil**

Tambahkan komentar singkat di PR/commit terakhir (bukan file baru) berisi versi Worker dan hasil cek manual. Tidak perlu commit tambahan bila tidak ada perubahan.

---

## Catatan Eksekusi

- Jalankan `npm`/`npx` dari `new-code1-cf`, jangan dari root.
- Jangan memakai `git add -A` dari root; add path eksplisit.
- Bila test template gagal karena `expected ">"` atau tag tidak seimbang, periksa penutup `</div>` pada blok `workspace`/`ws-detail`; jangan menghapus tag penutup lama secara membabi buta.
- Bila `window.BagianState` undefined di browser, pastikan `/bagian-state.js` dimuat sebelum `/app-common.js` dan tidak ada `defer`.
- Bila `selectedItem` error karena `baWorkItems` undefined pada Task 2-3, gunakan fallback `(this.baWorkItems || [])` seperti yang sudah ditulis.
