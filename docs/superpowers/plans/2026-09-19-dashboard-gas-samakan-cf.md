# Samakan Dashboard GAS dengan CF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard admin `new-code1` meniru CF: satu tab Berita Acara (proses dua tahap) dan Master Data per baris + Mahasiswa/CSV, runtime tetap Spreadsheet.

**Architecture:** Logika murni (kunci kegiatan, progres, fingerprint `_row`, parse CSV) di `new-code1/lib/dashboardPure.mjs` untuk tes Node; salinan fungsi global yang sama di `1_business.gs`. `getBagianAggregation` mengembalikan `units`/`orphanBa`. UI di `pages/dashboard.html` di-port dari CF dengan paginasi 20, chip Master Data horizontal, aksi baris horizontal, tanpa kartu unduh database.

**Tech Stack:** Google Apps Script V8, Spreadsheet, Vue 3 CDN, SheetJS `xlsx@0.18.5` CDN, `node --test` (tanpa npm baru).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-19-dashboard-gas-samakan-cf-design.md`
- Hanya `new-code1/pages/dashboard.html` dan `new-code1/1_business.gs` (+ helper tes). Jangan ubah `new-code1-cf/**`, portal, `bagian.html`, `detail-laporan.html`.
- Tidak ada kartu/endpoint Download Database.
- Password Admin/Staff plaintext; field kosong saat Ubah tidak menimpa.
- CSV mahasiswa maks 500 baris; upsert by NPM; kolom hanya NPM + Nama Lengkap.
- Identitas baris: NPM / Key / Email; sisanya `_row` + fingerprint. Jangan tambah kolom `id` di sheet.
- Nama `table` di RPC = nama sheet GAS (`MasterKegiatan`, …), bukan snake_case D1.
- Fungsi replace-all lama tidak dihapus; UI tidak memanggilnya.
- Semua mutasi `requireAuthorized` (admin) + `LockService.getScriptLock()` `waitLock(30000)`.
- Tanpa komentar kode baru.
- Tes: `node --test new-code1/test/*.test.mjs` dari root repo.

---

### Task 1: Helper murni + tes Node

**Files:**
- Create: `new-code1/lib/dashboardPure.mjs`
- Create: `new-code1/test/dashboard-pure.test.mjs`

**Interfaces:**
- Produces (semua export):
  - `norm(s: string) => string`
  - `normKegiatan(s: string) => string`
  - `kegiatanKey(bagian: string, blok: string, nama: string) => string`
  - `computeUnitProgress(unit) => { pendaftaran, pendukung, keputusan, final, pelaksanaan, selesai, counts: { peserta, keputusan, final } }`
  - `rowFingerprint(row: object, cols: string[]) => string`
  - `rowsMatchFingerprint(sheetRow, original, cols) => boolean`
  - `MAHASISWA_CSV_MAX = 500`
  - `parseMahasiswaCsv(text: string) => { error?: string, rows?: { npm, namaLengkap }[] }`
  - `planMahasiswaCsvUpsert(rows, existingNpms: Set<string>) => { error?: string, insert: number, update: number, skipped: number, parsed: { npm, nama }[] }`
  - `attachBaToUnits(units, baList, resolveBagian12) => { units, orphanBa }` (mutasi `unit.ba`)

- [ ] **Step 1: Write the failing test** in `new-code1/test/dashboard-pure.test.mjs`

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  kegiatanKey, computeUnitProgress, rowsMatchFingerprint,
  parseMahasiswaCsv, planMahasiswaCsvUpsert, attachBaToUnits, MAHASISWA_CSV_MAX
} from '../lib/dashboardPure.mjs';

describe('kegiatanKey', () => {
  it('menormalkan spasi dan huruf', () => {
    assert.equal(kegiatanKey('SGD', 'Blok 1', 'Tutorial - A'), kegiatanKey('sgd', '  BLOK 1 ', 'Tutorial - A'));
  });
});

describe('computeUnitProgress', () => {
  it('menandai tahap sebagian dan selesai', () => {
    const p = computeUnitProgress({
      peserta: [
        { statusPengajuan: 'Diterima', linkFinal: 'x' },
        { statusPengajuan: 'Menunggu', linkFinal: '' }
      ],
      baPendukung: [{ baId: 'BA-1' }],
      baPelaksanaan: [{ baId: 'BA-2', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi' }]
    });
    assert.equal(p.pendaftaran, 'all');
    assert.equal(p.pendukung, 'all');
    assert.equal(p.keputusan, 'partial');
    assert.equal(p.final, 'partial');
    assert.equal(p.pelaksanaan, 'all');
    assert.equal(p.selesai, 'all');
    assert.deepEqual(p.counts, { peserta: 2, keputusan: 1, final: 1 });
  });
  it('selesai hanya bila dosen, tanggal, dan jam lengkap', () => {
    const p = computeUnitProgress({
      peserta: [{ statusPengajuan: 'ACC', linkFinal: 'x' }],
      baPendukung: [],
      baPelaksanaan: [{ baId: 'BA-2', tanggal: '2026-09-20', jam: '', dosen: 'dr. Andi' }]
    });
    assert.equal(p.pelaksanaan, 'all');
    assert.equal(p.selesai, 'none');
  });
  it('membaca field klien Dosen/Tanggal Pelaksanaan/Jam', () => {
    const p = computeUnitProgress({
      peserta: [{ statusPengajuan: 'ACC', linkFinal: 'x' }],
      baPendukung: [],
      baPelaksanaan: [{ 'BA ID': 'BA-1', 'Tanggal Pelaksanaan': '2026-09-02', Jam: '08:00', Dosen: 'dr. Ilham' }]
    });
    assert.equal(p.selesai, 'all');
  });
});

describe('fingerprint', () => {
  const cols = ['Kategori', 'Nilai'];
  it('cocok jika trim sama', () => {
    assert.equal(rowsMatchFingerprint({ Kategori: 'Blok', Nilai: '1' }, { Kategori: ' Blok ', Nilai: '1' }, cols), true);
  });
  it('stale jika isi beda', () => {
    assert.equal(rowsMatchFingerprint({ Kategori: 'Blok', Nilai: '2' }, { Kategori: 'Blok', Nilai: '1' }, cols), false);
  });
});

describe('CSV mahasiswa', () => {
  it('parse header NPM + Nama Lengkap', () => {
    const r = parseMahasiswaCsv('NPM,Nama Lengkap\n123,Ada\n,Kosong\n456,Budi');
    assert.deepEqual(r.rows, [
      { npm: '123', namaLengkap: 'Ada' },
      { npm: '', namaLengkap: 'Kosong' },
      { npm: '456', namaLengkap: 'Budi' }
    ]);
  });
  it('tolak tanpa header wajib', () => {
    assert.ok(parseMahasiswaCsv('A,B\n1,2').error);
  });
  it('tolak duplikat NPM di file dan hitung insert/update', () => {
    const parsed = parseMahasiswaCsv('npm,nama\n1,A\n1,B');
    const plan = planMahasiswaCsvUpsert(parsed.rows, new Set());
    assert.ok(plan.error && plan.error.indexOf('duplikat') !== -1);
    const ok = planMahasiswaCsvUpsert(
      parseMahasiswaCsv('NPM,Nama Lengkap\n1,A\n2,B\n,X').rows,
      new Set(['1'])
    );
    assert.equal(ok.insert, 1);
    assert.equal(ok.update, 1);
    assert.equal(ok.skipped, 1);
    assert.equal(ok.parsed.length, 2);
  });
  it('menolak lebih dari MAHASISWA_CSV_MAX', () => {
    const rows = [];
    for (let i = 0; i < MAHASISWA_CSV_MAX + 1; i++) rows.push({ npm: String(i), namaLengkap: 'X' });
    assert.ok(planMahasiswaCsvUpsert(rows, new Set()).error);
  });
});

describe('attachBaToUnits', () => {
  it('cocok NPM dulu, lalu nama; sisanya orphan', () => {
    const units = [
      { key: 'sgd|blok 1|tutorial a', bagian: 'SGD', blok: 'Blok 1', label: 'Tutorial A', peserta: [{ npm: '111' }], ba: [] },
      { key: 'kkd|blok 1|klinik', bagian: 'KKD', blok: 'Blok 1', label: 'Klinik', peserta: [{ npm: '222' }], ba: [] }
    ];
    const baList = [
      { baId: 'BA-1', bagian: 'SGD', blok: 'Blok 1', namaKegiatan: 'Tutorial A extra', tanggal: '2026-01-01', fileUrl: 'u1', sumber: 'Admin', peserta: [{ npm: '111' }] },
      { baId: 'BA-2', bagian: 'KKD', blok: 'Blok 1', namaKegiatan: 'Klinik', tanggal: '2026-01-02', fileUrl: 'u2', sumber: 'Bagian', peserta: [] },
      { baId: 'BA-3', bagian: 'Ujian', blok: 'Blok 9', namaKegiatan: 'X', tanggal: '2026-01-03', fileUrl: 'u3', sumber: 'Admin', peserta: [] }
    ];
    const resolve = (b) => b;
    const out = attachBaToUnits(units, baList, resolve);
    assert.equal(units[0].ba[0].baId, 'BA-1');
    assert.equal(units[1].ba[0].baId, 'BA-2');
    assert.equal(out.orphanBa.length, 1);
    assert.equal(out.orphanBa[0].baId, 'BA-3');
  });
  it('kegiatanKey langsung menang', () => {
    const units = [{ key: 'sgd|b1|t', bagian: 'SGD', blok: 'B1', label: 'T', peserta: [], ba: [] }];
    const baList = [{ baId: 'BA-9', kegiatanKey: 'sgd|b1|t', bagian: 'X', blok: 'Y', namaKegiatan: 'Z', tanggal: '', fileUrl: '', sumber: 'Admin', peserta: [] }];
    attachBaToUnits(units, baList, (b) => b);
    assert.equal(units[0].ba[0].baId, 'BA-9');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test new-code1/test/dashboard-pure.test.mjs`

Expected: FAIL (`Cannot find module .../dashboardPure.mjs`)

- [ ] **Step 3: Write minimal implementation** in `new-code1/lib/dashboardPure.mjs`

Salin rumus CF `new-code1-cf/src/read/kegiatan.js` dan `kegiatanKey`/`normKegiatan` dari `new-code1-cf/src/read/common.js`. `attachBaToUnits` mengikuti urutan spec: `kegiatanKey` langsung → NPM ∩ kandidat Bagian+Blok → nama `===` atau `endsWith` → orphan. Duplikat BA dilewati dengan kunci `[norm(bagian), blok.lower, normKegiatan(nama), tanggal, fileUrl]`.

```js
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normKegiatan(s) {
  return norm(String(s || '').replace(/[\u2010-\u2015\u2212]/g, '-'));
}

export function kegiatanKey(bagian, blok, nama) {
  return [norm(bagian), norm(blok), normKegiatan(nama)].join('|');
}

function stage(done, total) {
  if (!total || done <= 0) return 'none';
  return done >= total ? 'all' : 'partial';
}

function field(obj, lowerKey, clientKey) {
  if (!obj) return '';
  const v = obj[lowerKey] !== undefined ? obj[lowerKey] : obj[clientKey];
  return v == null ? '' : String(v).trim();
}

export function computeUnitProgress(unit) {
  const peserta = (unit && unit.peserta) || [];
  const baPendukung = (unit && unit.baPendukung) || [];
  const baPelaksanaan = (unit && unit.baPelaksanaan) || [];
  const total = peserta.length;
  const decided = peserta.filter((p) => {
    const s = String(p.statusPengajuan || '').trim();
    return s === 'Diterima' || s === 'ACC' || s === 'Ditolak';
  }).length;
  const finalCount = peserta.filter((p) => p.linkFinal).length;
  const selesai = baPelaksanaan.some((b) =>
    field(b, 'dosen', 'Dosen') && field(b, 'tanggal', 'Tanggal Pelaksanaan') && field(b, 'jam', 'Jam')
  );
  return {
    pendaftaran: total > 0 ? 'all' : 'none',
    pendukung: baPendukung.length ? 'all' : 'none',
    keputusan: stage(decided, total),
    final: stage(finalCount, total),
    pelaksanaan: baPelaksanaan.length ? 'all' : 'none',
    selesai: selesai ? 'all' : 'none',
    counts: { peserta: total, keputusan: decided, final: finalCount }
  };
}

export function rowFingerprint(row, cols) {
  return (cols || []).map((c) => String(row && row[c] != null ? row[c] : '').replace(/\u00a0/g, ' ').trim()).join('\u001f');
}

export function rowsMatchFingerprint(sheetRow, original, cols) {
  return rowFingerprint(sheetRow, cols) === rowFingerprint(original, cols);
}

export const MAHASISWA_CSV_MAX = 500;

export function parseMahasiswaCsv(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return { error: 'CSV kosong.' };
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',' || ch === ';') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };
  const header = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ' '));
  const npmIdx = header.findIndex((h) => h === 'npm');
  const namaIdx = header.findIndex((h) => h === 'nama lengkap' || h === 'nama_lengkap' || h === 'nama');
  if (npmIdx === -1 || namaIdx === -1) return { error: 'Header CSV harus memuat kolom NPM dan Nama Lengkap.' };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    rows.push({ npm: String(cells[npmIdx] || '').trim(), namaLengkap: String(cells[namaIdx] || '').trim() });
  }
  return { rows: rows };
}

export function planMahasiswaCsvUpsert(rows, existingNpms) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length > MAHASISWA_CSV_MAX) return { error: 'Maksimal ' + MAHASISWA_CSV_MAX + ' baris.' };
  const parsed = [];
  const seen = new Set();
  let skipped = 0;
  for (let i = 0; i < list.length; i++) {
    const npm = String((list[i] && list[i].npm) || '').trim();
    if (!npm) { skipped++; continue; }
    if (seen.has(npm)) return { error: 'NPM duplikat di file: ' + npm };
    seen.add(npm);
    parsed.push({ npm: npm, nama: String((list[i] && (list[i].namaLengkap != null ? list[i].namaLengkap : list[i].nama)) || '').trim() });
  }
  if (!parsed.length) return { error: 'Tidak ada baris valid pada CSV.' };
  const existing = existingNpms || new Set();
  let inserted = 0;
  let updated = 0;
  parsed.forEach((row) => { if (existing.has(row.npm)) updated++; else inserted++; });
  return { insert: inserted, update: updated, skipped: skipped, parsed: parsed };
}

export function attachBaToUnits(units, baList, resolveBagian12) {
  const unitByKey = {};
  const unitByBag = {};
  const bagKey = (bagian, blok) => norm(bagian) + '|' + String(blok || '').replace(/\s+/g, ' ').trim().toLowerCase();
  (units || []).forEach((u) => {
    unitByKey[u.key] = u;
    const k = bagKey(u.bagian, u.blok);
    (unitByBag[k] = unitByBag[k] || []).push(u);
    if (!u.ba) u.ba = [];
  });
  const seen = new Set();
  const orphanBa = [];
  (baList || []).forEach((b) => {
    const dk = [norm(b.bagian), String(b.blok || '').toLowerCase(), normKegiatan(b.namaKegiatan), b.tanggal || '', b.fileUrl || ''].join('|');
    if (seen.has(dk)) return;
    seen.add(dk);
    const direct = b.kegiatanKey ? unitByKey[b.kegiatanKey] : null;
    if (direct) { direct.ba.push(b); return; }
    const resolved = resolveBagian12 ? (resolveBagian12(b.bagian, '', b.namaKegiatan) || b.bagian) : b.bagian;
    const candidates = unitByBag[bagKey(resolved, b.blok)] || [];
    const npms = (b.peserta || []).map((p) => p.npm).filter(Boolean);
    let matched = candidates.filter((u) => (u.peserta || []).some((p) => p.npm && npms.indexOf(p.npm) !== -1));
    if (!matched.length) {
      const bName = normKegiatan(b.namaKegiatan);
      matched = candidates.filter((u) => {
        const l = normKegiatan(u.label);
        return !!l && (bName === l || bName.endsWith(l));
      });
    }
    if (!matched.length) { orphanBa.push(b); return; }
    matched.forEach((u) => u.ba.push(b));
  });
  return { units: units, orphanBa: orphanBa };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test new-code1/test/dashboard-pure.test.mjs`

Expected: PASS, semua tes hijau.

- [ ] **Step 5: Commit**

```bash
git add new-code1/lib/dashboardPure.mjs new-code1/test/dashboard-pure.test.mjs
git commit -m "test: helper murni dashboard GAS (kunci BA, progres, CSV, fingerprint)"
```

---

### Task 2: `getBagianAggregation` kontrak CF

**Files:**
- Modify: `new-code1/1_business.gs` (`getBagianAggregation` / `_computeBagianAggregation` sekitar baris 1576–1649)
- Test: `new-code1/test/dashboard-pure.test.mjs` sudah menutupi `attachBaToUnits`; tidak menambah tes I/O sheet.

**Interfaces:**
- Consumes: `kegiatanKey`, `computeUnitProgress`, `attachBaToUnits` (salin ke fungsi global `_kegiatanKey`, `_computeUnitProgress`, `_attachBaToUnits`, `_normKegiatan` di `1_business.gs` — Apps Script tidak mengimpor `.mjs`)
- Produces: `getBagianAggregation() => { categories, labs, filters, summary, units, orphanBa }`
- Setiap unit: `key, bagian, blok, pilihan, detail, label, tanggal, tanggalList, peserta[], ba[], baPendukung, baPelaksanaan, pelaksanaan, dosenList, linkFinal, jumlahPeserta, progress, counts, pesertaDenganBa, statusBa, statusFinal`

- [ ] **Step 1: Salin helper global** di `1_business.gs` tepat sebelum `getBagianAggregation` (fungsi `_kegiatanKey`, `_normKegiatan`, `_computeUnitProgress`, `_attachBaToUnits` — isi sama dengan Task 1, tanpa `export`, nama diawali `_`).

Pakai `norm()` yang sudah ada di `0_code.gs` di dalam `_kegiatanKey`. Jangan duplikasi `norm`.

- [ ] **Step 2: Ganti tubuh agregasi**

Hapus `_computeBagianAggregation` lama yang mengembalikan `rows` sumber Pengajuan/Berita Acara. Ganti `getBagianAggregation` mengikuti `new-code1-cf/src/read/dashboard.js` fungsi `getBagianAggregation` (baris 150–320), dengan adaptasi GAS:

```javascript
function getBagianAggregation() {
    requireAuthorized(arguments[arguments.length - 1]);
    const pengajuan = getAllRowsCached('Pengajuan');
    const details = getAllRowsCached('DetailKegiatan');
    const labs = getMasterOptions('Lab');
    const pMap = {};
    pengajuan.forEach(function(p) { pMap[String(p['ID Pengajuan'] || '').trim()] = p; });

    const units = [];
    const unitIndex = {};
    const addPeserta = function(unit, row) {
        const dup = unit.peserta.some(function(x) {
            return (row.npm && x.npm === row.npm) || (!row.npm && row.idPengajuan && x.idPengajuan === row.idPengajuan);
        });
        if (!dup) unit.peserta.push(row);
    };

    details.forEach(function(d) {
        const idp = String(d['ID Pengajuan'] || '').trim();
        const p = pMap[idp] || {};
        const bagian = _resolveBagian12(d['Jenis Kegiatan'] || d.Bagian, d.Pilihan || d.Bagian, '', labs) || 'Lainnya';
        const blok = String(p.Blok || '').replace(/\s+/g, ' ').trim() || '-';
        const pilihan = String(d.Pilihan || '').trim();
        const detailText = String(d.Detail || '').trim();
        const label = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
        const key = _kegiatanKey(bagian, blok, label);
        if (unitIndex[key] === undefined) {
            unitIndex[key] = units.length;
            units.push({ key: key, bagian: bagian, blok: blok, pilihan: pilihan, detail: detailText, label: label, tanggal: '', tanggalList: [], peserta: [], ba: [], linkFinal: '' });
        }
        const unit = units[unitIndex[key]];
        addPeserta(unit, {
            npm: String(p.NPM || '').trim(),
            namaLengkap: String(p['Nama Lengkap'] || '').trim(),
            blok: String(p.Blok || '').trim(),
            statusPengajuan: String(p.Status || '').trim(),
            linkFinal: String(p['Link Final'] || '').trim(),
            idPengajuan: idp
        });
        const tgl = String(_clientDate(d['Tanggal Pelaksanaan']) || '').trim();
        if (tgl && unit.tanggalList.indexOf(tgl) === -1) unit.tanggalList.push(tgl);
        const lf = String(p['Link Final'] || '').trim();
        if (lf && !unit.linkFinal) unit.linkFinal = lf;
    });

    function collectBa(sheetName, pesertaMap, sumber) {
        return getAllRowsCached(sheetName).map(function(r) {
            const c = _clientRow(r);
            const baId = String(c['BA ID'] || '').trim();
            return {
                baId: baId,
                sumber: sumber,
                bagian: String(c.Bagian || '').trim(),
                blok: String(c.Blok || '').replace(/\s+/g, ' ').trim(),
                namaKegiatan: String(c['Nama Kegiatan'] || '').replace(/\s+/g, ' ').trim(),
                tanggal: String(c['Tanggal Pelaksanaan'] || '').trim(),
                jam: String(c.Jam || '').trim(),
                dosen: String(c.Dosen || '').trim(),
                kegiatanKey: String(c['Kegiatan Key'] || '').trim(),
                fileUrl: String(c['File URL'] || '').trim(),
                fileName: String(c['File Name'] || '').trim(),
                catatan: String(c.Catatan || '').trim(),
                timestamp: String(c.Timestamp || '').trim(),
                peserta: pesertaMap[baId] || []
            };
        });
    }

    const baList = collectBa('BeritaAcara', _getBaPesertaMap(), 'Bagian')
        .concat(collectBa('BeritaAcaraAdmin', _getBaPesertaMapAdmin(), 'Admin'));
    const attached = _attachBaToUnits(units, baList, function(raw, pilihan, nama) {
        return _resolveBagian12(raw, pilihan, nama, labs);
    });
    const orphanBa = attached.orphanBa || [];

    const npmSet = {};
    units.forEach(function(u) {
        const covered = {};
        (u.ba || []).forEach(function(b) {
            (b.peserta || []).forEach(function(p) { if (p.npm) covered[p.npm] = 1; });
        });
        u.pesertaDenganBa = u.peserta.filter(function(p) { return p.npm && covered[p.npm]; }).length;
        u.jumlahPeserta = u.peserta.length;
        u.statusBa = u.ba.length ? 'ada' : 'belum';
        u.statusFinal = u.linkFinal ? 'ada' : 'belum';
        u.baPendukung = u.ba.filter(function(b) { return b.sumber === 'Admin'; });
        u.baPelaksanaan = u.ba.filter(function(b) { return b.sumber === 'Bagian'; });
        u.pelaksanaan = u.baPelaksanaan.map(function(b) {
            return { baId: b.baId, tanggal: b.tanggal, jam: b.jam || '', dosen: b.dosen || '' };
        });
        const dosenSet = [];
        u.baPelaksanaan.forEach(function(b) {
            if (b.dosen && dosenSet.indexOf(b.dosen) === -1) dosenSet.push(b.dosen);
        });
        u.dosenList = dosenSet;
        u.progress = _computeUnitProgress(u);
        u.counts = u.progress.counts;
        u.tanggalList = u.tanggalList.slice().sort();
        u.tanggal = u.tanggalList[0] || '';
        u.peserta.forEach(function(p) { if (p.npm) npmSet[p.npm] = 1; });
    });
```

```javascript
    const blokSet = [];
    units.forEach(function(u) {
        const b = String(u.blok || '').trim();
        if (b && b !== '-' && blokSet.indexOf(b) === -1) blokSet.push(b);
    });
    const npmCount = Object.keys(npmSet).length;
    const summary = {
        totalKegiatan: units.length,
        totalPeserta: npmCount,
        denganBa: units.filter(function(u) { return u.ba.length; }).length,
        denganBaBagian: units.filter(function(u) { return u.ba.some(function(b) { return b.sumber === 'Bagian'; }); }).length,
        denganBaAdmin: units.filter(function(u) { return u.ba.some(function(b) { return b.sumber === 'Admin'; }); }).length,
        belumBa: units.filter(function(u) { return !u.ba.length; }).length,
        finalAcc: units.filter(function(u) { return u.linkFinal; }).length
    };
    summary.persenLengkap = summary.totalKegiatan ? Math.round((summary.denganBa / summary.totalKegiatan) * 100) : 0;
    return {
        categories: _getBagianOptions12(labs),
        labs: labs,
        filters: { bagian: _getBagianOptions12(labs), blok: blokSet.sort(), sumber: ['Bagian', 'Admin'] },
        summary: summary,
        units: units,
        orphanBa: orphanBa
    };
}
```

Hapus pemanggilan `_computeBagianAggregation(...)`. Pastikan tidak ada sisa referensi `data.rows` di backend.

- [ ] **Step 3:** `node --test new-code1/test/dashboard-pure.test.mjs` masih PASS.

- [ ] **Step 4: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(dashboard): getBagianAggregation mengembalikan units dan orphanBa"
```

---

### Task 3: API Master Data per baris

**Files:**
- Modify: `new-code1/1_business.gs` (`getMasterDataMonitor` ~1693; sisip fungsi baru setelah itu)
- Create: `new-code1/test/master-row-guard.test.mjs` (fingerprint + plan CSV saja; sudah ada di Task 1 — **jangan duplikasi tes**. Task ini tidak menambah file tes baru.)

**Interfaces:**
- Consumes: `_rowFingerprint` / `_rowsMatchFingerprint` (salin global dari Task 1)
- Produces:
  - `getMasterDataMonitor() => { mahasiswa, masterKegiatan, masterBagian, masterBiaya, config, bagianStaff, admin, bagianSettings }` dengan `_row` pada Kegiatan/Bagian/Biaya/Admin
  - `saveMahasiswa(payload)` `payload.row = { npm, namaLengkap, email, blok, keterangan, mode }`
  - `deleteMahasiswa(npm)`
  - `importMahasiswaCsv(payload)` `payload.rows`; max 500; return `{ success, inserted, updated, skipped, message }`
  - `saveMasterRow(payload)` `payload.table` salah satu `MasterKegiatan|MasterBagian|MasterBiaya|Config|BagianStaff|Admin`; `payload.row`; update `_row`+`original` atau Key/Email
  - `deleteMasterRow(payload)` Config ditolak

Konstanta mapping:

```javascript
var MASTER_ROW_SPECS = {
    MasterKegiatan: { cols: ['Kategori', 'Nilai'], key: '_row' },
    MasterBagian: { cols: ['Lab', 'Kegiatan Lab', 'Bagian', 'Email'], key: '_row' },
    MasterBiaya: { cols: ['Kegiatan', 'Biaya'], key: '_row' },
    Config: { cols: ['Key', 'Value'], key: 'Key' },
    BagianStaff: { cols: ['Email', 'Kategori', 'Nama', 'Pass'], key: 'Email', passwordCol: 'Pass', uniqueCol: 'Email' },
    Admin: { cols: ['Password', 'Nama'], key: '_row', passwordCol: 'Password' }
};
```

- [ ] **Step 1: Helper baris sheet**

```javascript
function _withRowNumbers(sheetName) {
    const sheet = getGlobalSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return [];
    const headers = getHeadersFromSheet(sheet);
    if (sheet.getLastRow() < 2) return [];
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    const out = [];
    values.forEach(function(row, i) {
        const hasValue = row.some(function(cell) {
            return cell !== null && cell !== undefined && String(cell).trim() !== '';
        });
        if (!hasValue) return;
        const obj = rowToObject(headers, row);
        obj._row = i + 2;
        out.push(obj);
    });
    return out;
}

function _lockMutate(fn) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        return fn();
    } finally {
        lock.releaseLock();
    }
}
```

- [ ] **Step 2: Perbarui `getMasterDataMonitor`**

```javascript
function getMasterDataMonitor() {
    requireAuthorized(arguments[arguments.length - 1]);
    return {
        mahasiswa: getAllRows('Mahasiswa'),
        masterKegiatan: _withRowNumbers('MasterKegiatan'),
        masterBagian: _withRowNumbers('MasterBagian'),
        masterBiaya: _withRowNumbers('MasterBiaya'),
        config: getAllRows('Config'),
        bagianStaff: getAllRows('BagianStaff'),
        admin: _withRowNumbers('Admin'),
        bagianSettings: _getBagianBaSettings()
    };
}
```

- [ ] **Step 3: Mahasiswa**

```javascript
function saveMahasiswa(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    return _lockMutate(function() {
        const row = (payload && payload.row) || {};
        const npm = String(row.npm != null ? row.npm : row.NPM || '').trim();
        if (!npm) return { success: false, message: 'NPM wajib diisi.' };
        const mode = String(row.mode || '') === 'update' ? 'update' : 'insert';
        const nama = String(row.namaLengkap != null ? row.namaLengkap : row['Nama Lengkap'] || '').trim();
        const email = String(row.email != null ? row.email : row.Email || '').trim();
        const blok = String(row.blok != null ? row.blok : row.Blok || '').trim();
        const keterangan = String(row.keterangan != null ? row.keterangan : row.Keterangan || '').trim();
        const existing = getRowByKey('Mahasiswa', 'NPM', npm);
        if (mode === 'insert') {
            if (existing) return { success: false, message: 'NPM ' + npm + ' sudah ada.' };
            appendRowSafe('Mahasiswa', { NPM: npm, 'Nama Lengkap': nama, Email: email, Blok: blok, Keterangan: keterangan });
            return { success: true, message: 'Mahasiswa ditambahkan.' };
        }
        if (!existing) return { success: false, message: 'NPM ' + npm + ' tidak ditemukan.' };
        upsertRowByKey('Mahasiswa', 'NPM', npm, { 'Nama Lengkap': nama, Email: email, Blok: blok, Keterangan: keterangan });
        return { success: true, message: 'Mahasiswa diperbarui.' };
    });
}

function deleteMahasiswa(npm) {
    requireAuthorized(arguments[arguments.length - 1]);
    return _lockMutate(function() {
        const key = String(npm || '').trim();
        if (!key) return { success: false, message: 'NPM wajib diisi.' };
        const existing = getRowByKey('Mahasiswa', 'NPM', key);
        if (!existing) return { success: false, message: 'NPM ' + key + ' tidak ditemukan.' };
        return deleteRowByKey('Mahasiswa', 'NPM', key, 'Hapus mahasiswa dari dashboard', getActorName());
    });
}

function importMahasiswaCsv(payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    return _lockMutate(function() {
        const list = (payload && payload.rows) || [];
        const existingRows = getAllRows('Mahasiswa');
        const existing = {};
        existingRows.forEach(function(r) { existing[String(r.NPM || '').trim()] = 1; });
        const plan = _planMahasiswaCsvUpsert(list, existing);
        if (plan.error) return { success: false, message: plan.error };
        let inserted = 0;
        let updated = 0;
        plan.parsed.forEach(function(row) {
            if (existing[row.npm]) {
                upsertRowByKey('Mahasiswa', 'NPM', row.npm, { 'Nama Lengkap': row.nama });
                updated++;
            } else {
                appendRowSafe('Mahasiswa', { NPM: row.npm, 'Nama Lengkap': row.nama, Email: '', Blok: '', Keterangan: '' });
                inserted++;
            }
        });
        return {
            success: true,
            inserted: inserted,
            updated: updated,
            skipped: plan.skipped,
            message: 'Impor selesai: ' + inserted + ' baru, ' + updated + ' diperbarui.'
        };
    });
}
```

`_planMahasiswaCsvUpsert(list, existingMap)`: salin `planMahasiswaCsvUpsert` tetapi `existing` adalah object map, cek `existing[npm]`. Maks 500.

Catatan: `upsertRowByKey` di `0_code.gs` **tidak menimpa field string kosong**. Untuk update mahasiswa lengkap (email/blok/keterangan boleh dikosongkan), `saveMahasiswa` update harus `setValues` langsung, bukan `upsertRowByKey`. Implementasi update:

```javascript
        const sheet = getGlobalSpreadsheet().getSheetByName('Mahasiswa');
        const headers = getHeadersFromSheet(sheet);
        const npmIdx = headers.indexOf('NPM');
        const rowIndex = findRowByColumnValue(sheet, npmIdx + 1, npm);
        const obj = { NPM: npm, 'Nama Lengkap': nama, Email: email, Blok: blok, Keterangan: keterangan };
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([objectToRow(headers, Object.assign({}, existing, obj))]);
        invalidateSheetCache('Mahasiswa');
```

CSV update **hanya** Nama Lengkap: boleh `upsertRowByKey` (nama non-kosong) atau setValues merge hanya kolom Nama.

- [ ] **Step 4: `saveMasterRow` / `deleteMasterRow`**

Untuk `key === '_row'`: baca baris `Number(row._row)`; bandingkan `_rowsMatchFingerprint(sheetObj, row.original || row, spec.cols)`; gagal → `{ success: false, message: 'Baris sudah berubah. Muat ulang Master Data.' }`.

Password: jika `spec.passwordCol` dan nilai baru `''` pada update, jangan ganti kolom itu (pakai nilai sheet).

Config insert: Key wajib, tolak duplikat case-insensitive. Config update: Key tidak berubah; set Value. `deleteMasterRow` jika `table === 'Config'` → `{ success: false, message: 'Config tidak boleh dihapus.' }`.

Staff unique Email case-insensitive (kecuali baris itu sendiri).

Insert `_row` tables: `appendRow` via `appendRowSafe` / `objectToRow` tanpa `_row`.

Setelah tulis Kegiatan, panggil `applyDropdownValidation` seperti `saveMasterKegiatan` lama.

- [ ] **Step 5:** `node --test new-code1/test/dashboard-pure.test.mjs` PASS.

- [ ] **Step 6: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(dashboard): CRUD Master Data per baris dan mahasiswa CSV"
```

---

### Task 4: Update/hapus BA Pelaksanaan dan Pendukung

**Files:**
- Modify: `new-code1/1_business.gs` (setelah `deleteBeritaAcaraAdmin` ~1665)

**Interfaces:**
- Produces:
  - `deleteBeritaAcaraBagian(baId) => { success, message }`
  - `updateBeritaAcaraBagian(baId, payload) => { success, message }` payload `{ tanggal, jam, dosen, catatan }`
  - `updateBeritaAcaraAdmin(baId, payload) => { success, message }` payload `{ tanggal, jam, catatan }` (tanpa dosen, seperti CF)

- [ ] **Step 1: Implement `deleteBeritaAcaraBagian`** meniru `deleteBeritaAcaraAdmin` tetapi sheet `BeritaAcara` + `BeritaAcaraPeserta`, `requireAuthorized`, trash Drive dari `File URL`.

```javascript
function deleteBeritaAcaraBagian(baId) {
    requireAuthorized(arguments[arguments.length - 1]);
    const baIdVal = String(baId || '').trim();
    if (!baIdVal) return { success: false, message: 'BA ID wajib diisi.' };
    const existing = getRowByKey('BeritaAcara', 'BA ID', baIdVal);
    if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
    deleteRowByKey('BeritaAcara', 'BA ID', baIdVal, 'Dihapus dari Panel Admin', getActorName());
    getAllRows('BeritaAcaraPeserta').forEach(function(r) {
        if (String(r['BA ID'] || '').trim() === baIdVal) {
            deleteRowByKey('BeritaAcaraPeserta', 'BA ID', baIdVal, 'Hapus peserta menyertai BA', getActorName());
        }
    });
    const fileUrl = String(existing['File URL'] || '');
    const idMatch = fileUrl.match(/[=\/]([\w\-]{20,})/);
    if (idMatch) {
        try { DriveApp.getFileById(idMatch[1]).setTrashed(true); } catch (e) {}
    }
    return { success: true, message: 'Berita acara berhasil dihapus.' };
}
```

Catatan: `deleteRowByKey` mencari **satu** baris per panggilan. Loop peserta: setelah hapus pertama, indeks bergeser. Hapus dari **bawah** atau kumpulkan semua rowIndex dulu. Pola aman: `while (getRowByKey('BeritaAcaraPeserta', 'BA ID', baIdVal)) deleteRowByKey(...)`.

- [ ] **Step 2: Update BA**

```javascript
function updateBeritaAcaraBagian(baId, payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    return _lockMutate(function() {
        const id = String(baId || '').trim();
        if (!id) return { success: false, message: 'BA ID wajib diisi.' };
        const existing = getRowByKey('BeritaAcara', 'BA ID', id);
        if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
        const p = payload || {};
        const tanggal = p.tanggal !== undefined ? String(p.tanggal || '').trim() : String(existing['Tanggal Pelaksanaan'] || '').trim();
        if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };
        const sheet = getGlobalSpreadsheet().getSheetByName('BeritaAcara');
        const headers = getHeadersFromSheet(sheet);
        const idx = headers.indexOf('BA ID');
        const rowIndex = findRowByColumnValue(sheet, idx + 1, id);
        const merged = Object.assign({}, existing, {
            'Tanggal Pelaksanaan': tanggal,
            Jam: p.jam !== undefined ? String(p.jam || '').trim() : existing.Jam,
            Dosen: p.dosen !== undefined ? String(p.dosen || '').trim() : existing.Dosen,
            Catatan: p.catatan !== undefined ? String(p.catatan || '').trim() : existing.Catatan
        });
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([objectToRow(headers, merged)]);
        invalidateSheetCache('BeritaAcara');
        return { success: true, message: 'Berita acara pelaksanaan diperbarui.' };
    });
}

function updateBeritaAcaraAdmin(baId, payload) {
    requireAuthorized(arguments[arguments.length - 1]);
    return _lockMutate(function() {
        const id = String(baId || '').trim();
        if (!id) return { success: false, message: 'BA ID wajib diisi.' };
        const existing = getRowByKey('BeritaAcaraAdmin', 'BA ID', id);
        if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
        const p = payload || {};
        const tanggal = p.tanggal !== undefined ? String(p.tanggal || '').trim() : String(existing['Tanggal Pelaksanaan'] || '').trim();
        if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };
        const sheet = getGlobalSpreadsheet().getSheetByName('BeritaAcaraAdmin');
        const headers = getHeadersFromSheet(sheet);
        const idx = headers.indexOf('BA ID');
        const rowIndex = findRowByColumnValue(sheet, idx + 1, id);
        const merged = Object.assign({}, existing, {
            'Tanggal Pelaksanaan': tanggal,
            Jam: p.jam !== undefined ? String(p.jam || '').trim() : existing.Jam,
            Catatan: p.catatan !== undefined ? String(p.catatan || '').trim() : existing.Catatan
        });
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([objectToRow(headers, merged)]);
        invalidateSheetCache('BeritaAcaraAdmin');
        return { success: true, message: 'Berita acara pendukung diperbarui.' };
    });
}
```

- [ ] **Step 3: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "feat(dashboard): kelola dan hapus BA Pelaksanaan dari admin"
```

---

### Task 5: UI tab Berita Acara + nav 4 item

**Files:**
- Modify: `new-code1/pages/dashboard.html`
- Create: `new-code1/test/dashboard-template.test.mjs`

**Interfaces:**
- Consumes: `getBagianAggregation().units/orphanBa`
- Produces: nav 4 item; `tab==='ba'` berisi kartu/tabel proses CF; `bab.showPanel` di bawah tabel; SheetJS CDN; CSS `btn-emerald`; paginasi 20.

Sumber salin: `new-code1-cf/public/dashboard.html` bagian:
- CSS `.btn-emerald` (baris 35–36 CF)
- `<section v-if="tab==='ba'">` (533–1012 CF) termasuk panel `bab`
- state `bagian: { units, orphanBa, chip, sortKey, sortDir, expanded, q, page }`
- computed `bagianSummary` … `bagianTableRows` (1713–1788 CF)
- methods `unitKeputusan` … `openPelaksanaanPanel` … `exportBagianExcel` … `deleteBaRecord` … `openKelolaBa`
- modal dialog CF (245–281) + `askConfirm` jika belum ada (`confirm()` native boleh untuk Hapus BA di task ini; Task 6 memakai dialog CSV)
- `<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>` sebelum Vue
- state `kelola`, `dosenPick`, `riwayat`, `dialog`
- `bab.showPanel` (GAS lama tidak punya; tambahkan)

**Paginasi (wajib, tidak ada di CF):**

```javascript
PAGE_SIZE: 20,
// data:
bagian: { ..., page: 1 },
// computed:
bagianPagedRows() {
    const rows = this.bagianTableRows;
    const size = 20;
    const page = Math.max(1, this.bagian.page || 1);
    const start = (page - 1) * size;
    return rows.slice(start, start + size);
},
bagianPageInfo() {
    const n = this.bagianTableRows.length;
    const size = 20;
    const pages = Math.max(1, Math.ceil(n / size));
    const page = Math.min(this.bagian.page || 1, pages);
    const start = n ? (page - 1) * size + 1 : 0;
    const end = Math.min(page * size, n);
    return { n: n, pages: pages, page: page, start: start, end: end };
}
```

Footer tabel:

```html
<div v-if="bagianPageInfo.n" class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
    <span>Menampilkan {{ bagianPageInfo.start }}–{{ bagianPageInfo.end }} dari {{ bagianPageInfo.n }}</span>
    <div class="flex items-center gap-1">
        <button class="btn-soft !px-2 !py-1" :disabled="bagianPageInfo.page<=1" @click="bagian.page--">Prev</button>
        <button class="btn-soft !px-2 !py-1" :disabled="bagianPageInfo.page>=bagianPageInfo.pages" @click="bagian.page++">Next</button>
    </div>
</div>
```

`v-for="r in bagianPagedRows"` (bukan seluruh `bagianTableRows`). Watch chip/filter/sortir: `this.bagian.page = 1`.

Kolom Aksi: `class="flex flex-row flex-wrap items-center gap-1"` (bukan `flex-col`).

Hapus `<section v-if="tab==='bagian'">` dan `<section v-if="tab==='baBagian'">` utuh.

Nav:

```javascript
navItems() {
    return [
        { key: 'pengajuan', icon: 'bi-inbox', label: 'Pengajuan', badge: true },
        { key: 'stats', icon: 'bi-bar-chart-line', label: 'Statistik' },
        { key: 'ba', icon: 'bi-file-earmark-pdf', label: 'Berita Acara' },
        { key: 'master', icon: 'bi-sliders', label: 'Master Data' }
    ];
},
pageTitle() {
    return { pengajuan: 'Telaah Pengajuan', stats: 'Statistik', ba: 'Berita Acara', master: 'Master Data' }[this.tab] || 'Dashboard';
}
```

`switchTab`:

```javascript
if (tab === 'ba') {
    if (!this.loaded.bagian) this.loadBagian();
    if (!this.loaded.ba) this.loadBa();
    if (this.bab.active) this.babLoad();
}
```

`loadBagian` seperti CF (units, orphanBa). Jangan tulis `this.bagian.all = data.rows`.

`openPelaksanaanPanel`: set `bab.showPanel = true`, prefill kategori SGD/KKD/Ujian/Praktikum + lab, `document.getElementById('bab-panel').scrollIntoView({ behavior: 'smooth' })`.

Eligible: `unitKeputusan` Diterima atau ACC.

- [ ] **Step 1: Write template test** `new-code1/test/dashboard-template.test.mjs`

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('dashboard template BA', () => {
  it('nav empat item tanpa Laporan Bagian / BA Bagian', () => {
    assert.match(html, /key: 'pengajuan'/);
    assert.match(html, /key: 'ba'/);
    assert.match(html, /key: 'master'/);
    assert.doesNotMatch(html, /label: 'Laporan Bagian'/);
    assert.doesNotMatch(html, /label: 'Berita Acara Bagian'/);
    assert.doesNotMatch(html, /tab==='bagian'/);
    assert.doesNotMatch(html, /tab==='baBagian'/);
  });
  it('header Pendukung dan Ekspor, tanpa Unggah Pelaksanaan di header', () => {
    assert.match(html, /Unggah BA Pendukung/);
    assert.match(html, /exportBagianExcel/);
    assert.doesNotMatch(html, /Unggah BA Pelaksanaan/);
  });
  it('aksi horizontal emerald Pelaksanaan', () => {
    assert.match(html, /btn-emerald/);
    assert.match(html, /openPelaksanaanPanel\(r\)/);
    assert.match(html, /flex flex-row flex-wrap/);
  });
  it('paginasi 20', () => {
    assert.match(html, /bagianPagedRows/);
    assert.match(html, /Menampilkan \{\{ bagianPageInfo.start \}\}/);
  });
  it('tidak ada Download Database', () => {
    assert.doesNotMatch(html, /downloadDatabase/);
    assert.doesNotMatch(html, /Download Database/);
  });
  it('memuat SheetJS', () => {
    assert.match(html, /xlsx@0\.18\.5/);
  });
});
```

- [ ] **Step 2:** `node --test new-code1/test/dashboard-template.test.mjs` — FAIL (nav lama, tidak ada btn-emerald).

- [ ] **Step 3: Port UI** sesuai daftar di atas. Jangan salin kartu `downloadDatabase` dari CF. Jangan ubah tab Pengajuan/Statistik.

- [ ] **Step 4:** `node --test new-code1/test/*.test.mjs` PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/dashboard.html new-code1/test/dashboard-template.test.mjs
git commit -m "feat(dashboard): satukan tab Berita Acara seperti CF"
```

---

### Task 6: UI Master Data per baris, chip, paginasi

**Files:**
- Modify: `new-code1/pages/dashboard.html` (section `tab==='master'`, state `master`, methods, modal)
- Modify: `new-code1/test/dashboard-template.test.mjs`

**Interfaces:**
- Consumes: `saveMahasiswa`, `deleteMahasiswa`, `importMahasiswaCsv`, `saveMasterRow`, `deleteMasterRow`, `getMasterDataMonitor`
- Kartu `table` = nama sheet: `Mahasiswa`, `MasterKegiatan`, `MasterBagian`, `MasterBiaya`, `Config`, `BagianStaff`, `Admin`
- Modal satu baris; Config tanpa Hapus; CSV Mahasiswa

- [ ] **Step 1: Extend template test**

Tambah di `dashboard-template.test.mjs`:

```js
describe('dashboard template master', () => {
  it('kartu mahasiswa dan tanpa saveFn replace-all di cards', () => {
    assert.match(html, /key: 'mahasiswa'/);
    assert.match(html, /table: 'Mahasiswa'/);
    assert.match(html, /openMasterRow/);
    assert.match(html, /onMahasiswaCsv/);
    assert.doesNotMatch(html, /saveFn: 'saveMasterKegiatan'/);
  });
  it('chip picker horizontal bukan sidebar 280px', () => {
    assert.doesNotMatch(html, /lg:grid-cols-\[280px_1fr\]/);
    assert.match(html, /master\.tab = m\.key/);
  });
  it('paginasi master 20', () => {
    assert.match(html, /masterPagedRows/);
  });
});
```

Run: FAIL sampai HTML berubah.

- [ ] **Step 2: State cards**

```javascript
cards: [
    { key: 'mahasiswa', title: 'Mahasiswa', short: 'Mahasiswa', desc: 'Data mahasiswa (NPM, nama, email, blok, keterangan). Impor massal lewat CSV kolom NPM + Nama Lengkap.', cols: ['NPM', 'Nama Lengkap', 'Email', 'Blok', 'Keterangan'], table: 'Mahasiswa', icon: 'bi-mortarboard' },
    { key: 'masterKegiatan', title: 'Master Kegiatan', short: 'Kegiatan', desc: 'Referensi kategori & nilai kegiatan (Blok, Ujian, SGD, KKD, Lab, Dosen).', cols: ['Kategori', 'Nilai'], table: 'MasterKegiatan', icon: 'bi-clipboard-check' },
    { key: 'masterBagian', title: 'Master Bagian', short: 'Bagian', desc: 'Pemetaan lab & kegiatan ke bagian beserta email tujuan notifikasi.', cols: ['Lab', 'Kegiatan Lab', 'Bagian', 'Email'], table: 'MasterBagian', icon: 'bi-diagram-3' },
    { key: 'masterBiaya', title: 'Master Biaya', short: 'Biaya', desc: 'Referensi biaya untuk setiap jenis kegiatan.', cols: ['Kegiatan', 'Biaya'], table: 'MasterBiaya', icon: 'bi-cash-stack' },
    { key: 'config', title: 'Config', short: 'Config', desc: 'Pengaturan nilai sistem (mis. mode bukti bayar).', cols: ['Key', 'Value'], table: 'Config', icon: 'bi-gear' },
    { key: 'bagianStaff', title: 'Bagian Staff', short: 'Bagian Staff', desc: 'Akun akses Panel Bagian: kolom Pass (D) adalah password login bagian.', cols: ['Email', 'Kategori', 'Nama', 'Pass'], table: 'BagianStaff', icon: 'bi-people' },
    { key: 'bagianSettings', title: 'Pengaturan Bagian', short: 'Pengaturan Bagian', desc: 'Aturan Berita Acara untuk Panel Bagian: status peserta yang boleh dibuat BA.', icon: 'bi-file-earmark-check', settings: true },
    { key: 'admin', title: 'Admin', short: 'Admin', desc: 'Password login dashboard (kolom A) + nama tampilan (kolom B).', cols: ['Password', 'Nama'], table: 'Admin', icon: 'bi-shield-lock' }
],
rowModal: { open: false, table: '', cardKey: '', title: '', cols: [], disabled: [], mode: 'insert', fields: {}, original: null, originalId: 0 },
page: 1
```

Hapus `master.modal`, `saveFn`, `editKey` editor seluruh tabel. Hapus markup `v-if="master.modal"` (editor tabel lama).

- [ ] **Step 3: Layout chip + tabel**

Ganti grid sidebar CF menjadi:

```html
<div class="mb-4 flex flex-wrap gap-2">
    <button v-for="m in masterCards" :key="m.key" type="button"
        class="master-stat !w-auto"
        :class="{ active: master.tab === m.key }"
        @click="master.tab = m.key; master.search = ''; master.page = 1">
        <span class="master-stat-icon"><i :class="m.icon"></i></span>
        <span class="text-sm font-semibold text-slate-800">{{ m.short }}</span>
    </button>
</div>
```

Tabel: `v-for="(r,i) in masterPagedRows"`. Kolom Aksi:

```html
<div class="flex flex-row items-center gap-1">
    <button class="master-row-btn" title="Ubah" @click="openMasterRow(activeMasterCard.key, r)"><i class="bi bi-pencil"></i></button>
    <button v-if="activeMasterCard.key !== 'config'" class="master-row-btn danger" title="Hapus" @click="deleteMasterRow(r)"><i class="bi bi-trash"></i></button>
</div>
```

Tambah CSS `.master-row-btn` dari CF. Footer paginasi sama pola BA (`masterPageInfo`).

Computed:

```javascript
activeMasterRows() { /* filter search seperti sekarang */ },
masterPagedRows() {
    const rows = this.activeMasterRows;
    const size = 20;
    const page = Math.max(1, this.master.page || 1);
    return rows.slice((page - 1) * size, page * size);
}
```

Watch `master.search` / `master.tab` → `master.page = 1`.

- [ ] **Step 4: Methods**

`openMasterRow(cardKey, row)`: `original: row ? Object.assign({}, row) : null`; disabled NPM/Key pada update; `originalId: row && row._row`.

`saveMasterRow`:

```javascript
async saveMasterRow() {
    const rm = this.master.rowModal;
    this.master.saving = true;
    try {
        let res;
        if (rm.table === 'Mahasiswa') {
            res = await this.run('saveMahasiswa', {
                row: {
                    npm: String(rm.fields.NPM || '').trim(),
                    namaLengkap: String(rm.fields['Nama Lengkap'] || '').trim(),
                    email: String(rm.fields.Email || '').trim(),
                    blok: String(rm.fields.Blok || '').trim(),
                    keterangan: String(rm.fields.Keterangan || '').trim(),
                    mode: rm.mode
                }
            });
        } else {
            const row = Object.assign({}, rm.fields, { mode: rm.mode });
            if (rm.original && rm.original._row) {
                row._row = rm.original._row;
                row.original = rm.original;
            }
            res = await this.run('saveMasterRow', { table: rm.table, row: row });
        }
        if (res && res.success === false) { this.notify((res && res.message) || 'Gagal menyimpan.', false); return; }
        this.notify((res && res.message) || 'Disimpan.');
        this.master.rowModal.open = false;
        await this.loadMaster();
    } catch (e) {
        this.notify('Gagal: ' + e, false);
    } finally {
        this.master.saving = false;
    }
}
```

`deleteMasterRow(row)`: konfirmasi; mahasiswa → `deleteMahasiswa(row.NPM)`; lain → `deleteMasterRow({ table, _row, original: row, Key, Email })`.

Config Value `BUKTI_MODE`: di tabel tampilkan Bypass/Strict; di modal dropdown `strict`/`lenggang`.

CSV: `parseCsv` di klien (boleh salin `parseMahasiswaCsv` logic); max 500; dialog `confirm` native atau modal: `insert + update + skipped + existing.size`. Lalu `importMahasiswaCsv({ rows: valid })`.

Password kosong: kirim `Pass`/`Password` `''` pada update; backend tidak menimpa.

- [ ] **Step 5:** `node --test new-code1/test/*.test.mjs` PASS.

- [ ] **Step 6: Commit**

```bash
git add new-code1/pages/dashboard.html new-code1/test/dashboard-template.test.mjs
git commit -m "feat(dashboard): Master Data per baris, mahasiswa CSV, chip dan paginasi"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| Nav 4 item, hapus Laporan Bagian / BA Bagian | 5 |
| Tab BA proses, 5 kartu, batang+peta, chip, orphan | 5 + 2 |
| Kolom Progres/Realisasi/Dosen, eligible Diterima/ACC | 2 + 5 |
| Aksi horizontal, Pelaksanaan emerald, scroll panel | 5 |
| Ekspor SheetJS, bukan dump DB | 5 |
| Paginasi 20 BA | 5 |
| `getBagianAggregation` units/orphanBa | 2 |
| Kelola/Hapus BA | 4 |
| Chip Master Data horizontal | 6 |
| Mahasiswa CRUD + CSV 500 | 3 + 6 |
| Per-baris + `_row` fingerprint | 1 + 3 + 6 |
| Config tanpa Hapus, password plaintext | 3 + 6 |
| Tidak ada Download Database | 5 tes negatif |
| Tidak hash, tidak ubah CF / portal / detail-laporan | semua |

## Placeholder scan

Tidak ada TBD. Fungsi GAS tidak diimpor dari `.mjs` — salinan global eksplisit di Task 2–3.

## Type consistency

- `attachBaToUnits` / `_attachBaToUnits` mengembalikan `{ units, orphanBa }`.
- `table` UI = nama sheet (`MasterKegiatan`, bukan `master_kegiatan`).
- CSV max `MAHASISWA_CSV_MAX = 500`.
- Fingerprint gagal: pesan `Baris sudah berubah. Muat ulang Master Data.`
