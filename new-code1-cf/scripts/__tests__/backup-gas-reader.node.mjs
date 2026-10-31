import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = join(here, '..', '..');
const gasDir = join(projectDir, 'tools', 'gas-backup-reader');

/**
 * Memuat seluruh berkas .gs ke satu konteks VM tanpa API Google.
 * Fungsi murni bisa diuji langsung; fungsi yang memanggil SpreadsheetApp/
 * DriveApp tidak dijalankan di sini.
 */
function loadReader() {
  // Intrinsik host disuntikkan supaya array/objek hasil kode .gs memakai
  // prototipe yang sama dengan Node — kalau tidak, assert.deepEqual gagal
  // karena perbedaan realm (bukan karena isi berbeda).
  const sandbox = {
    console,
    Array, Object, JSON, Math, Date, Number, String, Boolean, RegExp, Error, TypeError,
    isNaN, parseInt, parseFloat, Intl, Promise, Set, Map
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const files = readdirSync(gasDir).filter((f) => f.endsWith('.gs')).sort();
  assert.ok(files.length >= 7, 'berkas .gs tidak lengkap: ' + files.join(', '));
  for (const file of files) {
    vm.runInContext(readFileSync(join(gasDir, file), 'utf8'), context, { filename: file });
  }
  return sandbox;
}

const fixture = {
  schemaVersion: 1,
  database: 'inhal-poc',
  label: '20261031-0100',
  generatedAt: '2026-10-31T01:00:12.000Z',
  plan: { name: 'free', maxBytes: 524288000, warnBytes: 314572800, label: 'Workers Free (500 MB)' },
  source: { file: 'inhal-poc.sql', bytes: 4096, sha256: 'ABCDEF0123456789ABCDEF0123456789' },
  verification: { integrity: 'ok', coreTables: ['mahasiswa', 'pengajuan'], missingCoreTables: [], ok: true },
  counts: { mahasiswa: 3, pengajuan: 2, jadwal_pelaksanaan: 1 },
  totalRows: 6,
  uploads: { present: true, rows: 0, contentBytes: 0 },
  excludedColumns: {},
  size: { estimatedBytes: 2048, estimatedHuman: '0.00 MB', status: 'ok' },
  csv: {
    dir: '20261031-0100-csv',
    manifestFile: '20261031-0100-csv/manifest.csv',
    tables: [
      { table: 'mahasiswa', file: 'mahasiswa.csv', rows: 3, columns: 5, bytes: 100, sha256: 'AAA' },
      { table: 'pengajuan', file: 'pengajuan.csv', rows: 2, columns: 40, bytes: 200, sha256: 'BBB' },
      { table: 'jadwal_pelaksanaan', file: 'jadwal_pelaksanaan.csv', rows: 1, columns: 11, bytes: 90, sha256: 'CCC' }
    ],
    totalRows: 6,
    totalBytes: 390
  }
};

/** Salinan realm-host supaya deepEqual tidak gagal karena perbedaan prototipe VM. */
const plain = (value) => JSON.parse(JSON.stringify(value));

test('parseManifest menormalkan manifest lengkap', () => {
  const g = loadReader();
  const m = g.parseManifest(JSON.stringify(fixture));
  assert.equal(m.label, '20261031-0100');
  assert.equal(m.database, 'inhal-poc');
  assert.equal(m.planLabel, 'Workers Free (500 MB)');
  assert.equal(m.integrity, 'ok');
  assert.equal(m.verificationOk, true);
  assert.equal(m.totalRows, 6);
  assert.equal(m.csv.tables.length, 3);
  assert.equal(m.csv.totalBytes, 390);
  assert.equal(m.sizeStatus, 'ok');
  assert.deepEqual(plain(m.warnings), []);
  assert.equal(m.counts.pengajuan, 2);
});

test('parseManifest menolak manifest rusak dengan pesan jelas', () => {
  const g = loadReader();
  assert.throws(() => g.parseManifest('bukan json'), /tidak dapat dibaca sebagai JSON/);
  assert.throws(() => g.parseManifest('[]'), /tidak berisi objek/);
  assert.throws(() => g.parseManifest(JSON.stringify({ counts: {} })), /tidak memuat "label"/);
  assert.throws(() => g.parseManifest(JSON.stringify({ label: 'X' })), /tidak memuat "counts"/);
});

test('parseManifest menandai arsip lama tanpa CSV dan integritas bermasalah', () => {
  const g = loadReader();
  const lama = Object.assign({}, fixture, { csv: undefined });
  lama.verification = { integrity: 'gagal', missingCoreTables: ['berita_acara'], ok: false };
  const m = g.parseManifest(JSON.stringify(lama));
  assert.equal(m.csv, null);
  assert.equal(m.verificationOk, false);
  assert.equal(m.warnings.some((w) => w.indexOf('belum memuat CSV') !== -1), true);
  assert.equal(m.warnings.some((w) => w.indexOf('integrity_check: gagal') !== -1), true);
  assert.equal(m.warnings.some((w) => w.indexOf('tabel inti hilang: berita_acara') !== -1), true);
});

test('manifestSummaryRows dan manifestTableRows siap ditulis ke sheet', () => {
  const g = loadReader();
  const m = g.parseManifest(JSON.stringify(fixture));
  const summary = g.manifestSummaryRows(m);
  const map = {};
  summary.forEach((row) => { map[row[0]] = row[1]; });
  assert.equal(summary.length, 15);
  assert.equal(map['Label'], '20261031-0100');
  assert.equal(map['Total baris'], '6');
  assert.equal(map['Verifikasi inti'], 'LULUS');
  assert.equal(map['Peringatan'], '-');
  assert.match(map['Artefak CSV'], /3 tabel/);

  const rows = g.manifestTableRows(m);
  assert.deepEqual(plain(rows.map((r) => r[0])), ['jadwal_pelaksanaan', 'mahasiswa', 'pengajuan']);
  assert.deepEqual(plain(rows[1]), ['mahasiswa', 3, 5, '100 B', 'ada CSV']);
  const tanpaCsv = g.manifestTableRows(Object.assign({}, m, { csv: null }));
  assert.equal(tanpaCsv[0][4], 'hanya dump');
});

test('compareManifests menandai sama, berubah, hilang, dan baru', () => {
  const g = loadReader();
  const a = g.parseManifest(JSON.stringify(fixture));
  const b = g.parseManifest(JSON.stringify(Object.assign({}, fixture, {
    label: '20261101-0100',
    counts: { mahasiswa: 3, pengajuan: 5, berita_acara: 2 },
    totalRows: 10
  })));
  const rows = g.compareManifests(a, b);
  const map = {};
  rows.forEach((r) => { map[r[0]] = r; });
  assert.deepEqual(plain(map['mahasiswa']), ['mahasiswa', 3, 3, 0, 'sama']);
  assert.deepEqual(plain(map['pengajuan']), ['pengajuan', 2, 5, -3, 'berubah']);
  assert.deepEqual(plain(map['jadwal_pelaksanaan']), ['jadwal_pelaksanaan', 1, '', '', 'hilang']);
  assert.deepEqual(plain(map['berita_acara']), ['berita_acara', '', 2, '', 'baru']);

  const verdict = g.compareVerdict(rows);
  assert.equal(verdict.hilang, 1);
  assert.equal(verdict.baru, 1);
  assert.equal(verdict.berubah, 1);
  assert.equal(verdict.sama, 1);
  assert.equal(verdict.selisihBaris, 6 - 10);
});


test('label dan nama berkas manifest dikenali', () => {
  const g = loadReader();
  assert.equal(g.labelFromFileName('20261031-0100-manifest.json'), '20261031-0100');
  assert.equal(g.labelFromFileName('inhal-20261031-0100-manifest.json'), '20261031-0100');
  assert.equal(g.labelFromFileName('manifest.json'), '');
  assert.equal(g.isManifestFileName('20261031-0100-manifest.json'), true);
  assert.equal(g.isManifestFileName('20261031-0100-database.xlsx'), false);
});

test('allowlist email mendukung domain wildcard dan menolak kosong', () => {
  const g = loadReader();
  assert.deepEqual(plain(g.parseAllowlist('a@x.id, B@Y.id\n*@umsu.ac.id')), ['a@x.id', 'b@y.id', '*@umsu.ac.id']);
  assert.equal(g.isAllowedEmail('a@x.id', ['a@x.id']), true);
  assert.equal(g.isAllowedEmail('A@X.ID', ['a@x.id']), true);
  assert.equal(g.isAllowedEmail('siapa@umsu.ac.id', ['*@umsu.ac.id']), true);
  assert.equal(g.isAllowedEmail('siapa@lain.id', ['*@umsu.ac.id']), false);
  assert.equal(g.isAllowedEmail('a@x.id', []), false);
  assert.equal(g.isAllowedEmail('', ['*@umsu.ac.id']), false);
  assert.equal(g.isAllowedEmail('a@x.id', 'a@x.id'), true);
});

test('runbook restore memuat prosedur A-D dan perintah kunci', () => {
  const g = loadReader();
  const rows = g.checklistRows();
  assert.ok(rows.length >= 12);
  const tahap = new Set(rows.map((r) => r[0]));
  ['A. Time Travel', 'B. Artefak GitHub', 'C. Arsip Drive', 'D. Drill lokal'].forEach((t) => {
    assert.equal(tahap.has(t), true, 'tahap hilang: ' + t);
  });
  rows.forEach((r) => assert.equal(r.length, 4, 'baris runbook harus 4 kolom'));
  const semua = rows.map((r) => r.join(' ')).join('\n');
  assert.match(semua, /time-travel restore/);
  assert.match(semua, /verify-backup\.mjs/);
  assert.match(semua, /decrypt-backup\.mjs/);
  assert.match(semua, /d1 execute inhal-poc-restore --remote/);
  assert.match(semua, /in-place/);
});

test('drillRow menormalkan bukti drill dan menolak hasil kosong', () => {
  const g = loadReader();
  const row = g.drillRow({ tanggal: '2026-10-31', label: ' 20261031-0100 ', hasil: 'LULUS', tabelCocok: '5/5', catatan: 'ok' });
  assert.deepEqual(plain(row), ['2026-10-31', '20261031-0100', 'LULUS', '5/5', 'ok']);
  const tanpaTanggal = g.drillRow({ label: 'X', hasil: 'LULUS' });
  assert.match(tanpaTanggal[0], /^\d{4}-\d{2}-\d{2}$/);
  assert.throws(() => g.drillRow({ label: 'X' }), /Hasil drill wajib diisi/);
  assert.equal(g.drillSummaryRows([{ label: 'X', hasil: 'GAGAL' }]).length, 1);
});

test('setiap fungsi pada menu benar-benar ada', () => {
  const g = loadReader();
  const names = g.menuFunctionNames();
  assert.deepEqual(plain(names), ['showSummary', 'showCompare', 'ensureChecklist', 'recordDrill', 'showAbout']);
  names.forEach((fn) => assert.equal(typeof g[fn], 'function', 'fungsi menu tidak ditemukan: ' + fn));
  assert.equal(g.menuSpec().filter((i) => i.separator).length, 2);
  assert.equal(g.READER_VERSION, '1.0.0');
});

test('aboutRows menampilkan versi, allowlist, dan batas tahap 1', () => {
  const g = loadReader();
  const rows = g.aboutRows({ version: '1.0.0', email: 'a@x.id', allowlist: ['a@x.id'] });
  const map = {};
  rows.forEach((r) => { map[r[0]] = r[1]; });
  assert.equal(map['Versi reader'], '1.0.0');
  assert.equal(map['Pengguna'], 'a@x.id');
  assert.equal(map['Allowlist'], 'a@x.id');
  assert.match(map['Cakupan'], /manifest\.json/);
  assert.match(map['Restore'], /Tidak dilakukan/);
});

test('manifest hasil generator nyata terbaca oleh reader', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inhal-gas-'));
  const dump = join(dir, 'drill.sql');
  const schema = readFileSync(join(projectDir, 'schema.sql'), 'utf8');
  const inserts = [
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T00:00:00','INHAL-1','2201010001','Aisyah Putri','A','SGD','ACC');",
    "INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T00:00:00','JDW-1','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-20','08:00','dr. Andi','',1);"
  ];
  writeFileSync(dump, schema + '\n' + inserts.join('\n') + '\n');

  execFileSync(process.execPath, ['scripts/backup-snapshot.mjs', dump, '--out=' + join(dir, 'out'), '--label=GASDRIL', '--plan=free'], {
    cwd: projectDir,
    stdio: 'pipe'
  });

  const manifest = JSON.parse(readFileSync(join(dir, 'out', 'manifest.json'), 'utf8'));
  const g = loadReader();
  const m = g.parseManifest(JSON.stringify(manifest));

  assert.equal(m.label, 'GASDRIL');
  assert.equal(m.integrity, 'ok');
  assert.equal(m.verificationOk, true);
  assert.deepEqual(plain(m.warnings), []);
  assert.equal(m.totalRows, manifest.totalRows);
  assert.equal(m.csv.tables.length, manifest.csv.tables.length);
  assert.equal(m.csv.totalRows, manifest.csv.totalRows);
  assert.equal(m.counts.pengajuan, 1);
  assert.equal(m.counts.jadwal_pelaksanaan, 1);

  const byTable = {};
  m.csv.tables.forEach((t) => { byTable[t.table] = t; });
  Object.keys(m.counts).forEach((table) => {
    assert.ok(byTable[table], 'CSV tidak ada untuk tabel ' + table);
    assert.equal(byTable[table].rows, m.counts[table], 'baris CSV tidak cocok untuk ' + table);
  });
});
