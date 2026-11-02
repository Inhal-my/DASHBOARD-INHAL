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

/** Memuat seluruh berkas .gs ke satu konteks VM tanpa API Google. */
function loadReader(extra) {
  const base = {
    console, Array, Object, JSON, Math, Date, Number, String, Boolean, RegExp, Error,
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' } }
  };
  const sandbox = Object.assign(base, extra || {});
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const files = readdirSync(gasDir).filter((f) => f.endsWith('.gs')).sort();
  for (const file of files) {
    vm.runInContext(readFileSync(join(gasDir, file), 'utf8'), context, { filename: file });
  }
  return sandbox;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test('parseCsvText menangani kutip, newline dalam sel, CRLF, dan BOM', () => {
  const g = loadReader();
  const rows = g.parseCsvText('a,b\r\n1,"x,y"\r\n2,"p\nq"\r\n3,"kata ""kutip"""\r\n');
  assert.deepEqual(plain(rows), [['a', 'b'], ['1', 'x,y'], ['2', 'p\nq'], ['3', 'kata "kutip"']]);
  assert.deepEqual(plain(g.parseCsvText('')), []);
  assert.deepEqual(plain(g.parseCsvText('hanya\r\n')), [['hanya']]);
  const bom = g.parseCsvText('\uFEFFtabel,nilai\r\n1,2\r\n');
  assert.deepEqual(plain(bom), [['tabel', 'nilai'], ['1', '2']]);
});

test('csvToTable menormalkan lebar baris dan sheetNameForTable aman', () => {
  const g = loadReader();
  const t = g.csvToTable('a,b,c\r\n1\r\n4,5,6,7\r\n');
  assert.deepEqual(plain(t.header), ['a', 'b', 'c']);
  assert.deepEqual(plain(t.rows), [['1', '', ''], ['4', '5', '6']]);
  assert.deepEqual(plain(g.csvToTable('')), { header: [], rows: [] });
  assert.equal(g.sheetNameForTable('pengajuan'), 'bk_pengajuan');
  assert.equal(g.sheetNameForTable('berita acara'), 'bk_berita_acara');
  assert.equal(g.sheetNameForTable(''), 'bk_tabel');
});

test('planImportJobs memecah per chunk dan melewati tabel terlalu besar', () => {
  const g = loadReader();
  const plan = g.planImportJobs([
    { table: 'mahasiswa', rows: 5, columns: 5 },
    { table: 'besar', rows: 900000, columns: 40 },
    { table: 'kosong', rows: 0, columns: 3 }
  ], { rowsPerRun: 2, maxCells: 500000 });
  assert.deepEqual(plain(plan.jobs.map((j) => j.table + ':' + j.from + '-' + j.to)), [
    'mahasiswa:0-2', 'mahasiswa:2-4', 'mahasiswa:4-5', 'kosong:0-0'
  ]);
  assert.equal(plan.skipped.length, 1);
  assert.equal(plan.skipped[0].table, 'besar');
});

test('buildInsertSql meng-escape kutip dan menulis NULL untuk sel kosong', () => {
  const g = loadReader();
  const sql = plain(g.buildInsertSql('pengajuan', ['npm', 'nama'], [['1', "O'Brien"], ['', '']]));
  assert.equal(sql[0], 'INSERT INTO "pengajuan" ("npm", "nama") VALUES (\'1\', \'O\'\'Brien\');');
  assert.equal(sql[1], 'INSERT INTO "pengajuan" ("npm", "nama") VALUES (NULL, NULL);');
  assert.deepEqual(plain(g.buildInsertSql('x', [], [])), []);
});

test('buildRestoreStatements menghitung statement per tabel', () => {
  const g = loadReader();
  const packs = plain(g.buildRestoreStatements([
    { table: 'mahasiswa', csv: 'npm,nama\r\n1,Ani\r\n2,Budi\r\n' },
    { table: 'kosong', csv: 'a\r\n' }
  ]));
  assert.equal(packs.length, 2);
  assert.equal(packs[0].table, 'mahasiswa');
  assert.equal(packs[0].count, 2);
  assert.equal(packs[0].statements.length, 2);
  assert.equal(packs[1].count, 0);
});

test('parseManifestCsv memetakan kolom manifest.csv ke objek tabel', () => {
  const g = loadReader();
  const text = 'tabel,file,baris,kolom,bytes,sha256\r\npengajuan,pengajuan.csv,2,40,900,ABC\r\nmahasiswa,mahasiswa.csv,0,5,40,DEF\r\n';
  const rows = plain(g.parseManifestCsv(text));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { table: 'pengajuan', file: 'pengajuan.csv', rows: 2, columns: 40, bytes: 900, sha256: 'ABC' });
  assert.equal(rows[1].rows, 0);
});

test('verifyCsvChecksums menandai cocok, beda, dan gagal baca', () => {
  const g = loadReader({ Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: () => [1, 2, 3] } });
  const entries = [
    { table: 'a', fileId: 'f1', sha256: '010203' },
    { table: 'b', fileId: 'f2', sha256: 'LAIN' },
    { table: 'c', fileId: 'f3', sha256: '010203' }
  ];
  const reader = (id) => { if (id === 'f3') throw new Error('gagal'); return 'abc'; };
  const report = plain(g.verifyCsvChecksums(entries, reader));
  assert.equal(report[0].status, 'cocok');
  assert.equal(report[1].status, 'BEDA');
  assert.equal(report[2].status, 'gagal baca');
});

test('searchImportedRows mencari lintas sheet dan menghormati batas', () => {
  const g = loadReader();
  const sheets = [
    { name: 'bk_pengajuan', values: [['npm', 'nama'], ['2201010001', 'Aisyah'], ['2201010002', 'Budi']] },
    { name: 'bk_mahasiswa', values: [['npm', 'nama'], ['2201010001', 'Aisyah Putri']] }
  ];
  const rows = plain(g.searchImportedRows(sheets, 'aisyah', 10));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sheet, 'bk_pengajuan');
  assert.equal(rows[0].row, 2);
  assert.equal(plain(g.searchImportedRows(sheets, 'aisyah', 1)).length, 1);
  assert.deepEqual(plain(g.searchImportedRows(sheets, '', 10)), []);
});

test('menu tahap 2 lengkap dan perintah restore menyebut langkah aman', () => {
  const g = loadReader();
  const names = plain(g.menuFunctionNames());
  ['showImportCsv', 'showResumeImport', 'showSearch', 'showChecksum', 'showRestorePackage', 'clearImportedSheets'].forEach((fn) => {
    assert.ok(names.includes(fn), 'menu hilang: ' + fn);
    assert.equal(typeof g[fn], 'function', 'fungsi menu tidak ada: ' + fn);
  });
  const perintah = plain(g.restoreCommandRows('20261031-0100')).map((r) => r[1]).join('\n');
  assert.match(perintah, /d1 create inhal-poc-restore/);
  assert.match(perintah, /verify-backup\.mjs/);
  assert.match(perintah, /restore-20261031-0100\.sql/);
});

test('arsip CSV hasil generator terbaca dan menghasilkan statement sesuai manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inhal-gascsv-'));
  const dump = join(dir, 'drill.sql');
  const schema = readFileSync(join(projectDir, 'schema.sql'), 'utf8');
  const insert = 'INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) ' +
    "VALUES ('2026-10-01T00:00:00','INHAL-1','2201010001','Aisyah Putri','A','SGD','ACC');\n";
  writeFileSync(dump, schema + '\n' + insert);

  execFileSync(process.execPath, ['scripts/backup-snapshot.mjs', dump, '--out=' + join(dir, 'out'), '--label=GS2', '--plan=free'], {
    cwd: projectDir, stdio: 'pipe'
  });
  const out = join(dir, 'out');
  const manifestJson = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  const csvDir = join(out, manifestJson.csv.dir);

  const g = loadReader({ sha256Hex: (text) => 'X' + String(text).length });
  const manifestRows = plain(g.parseManifestCsv(readFileSync(join(csvDir, 'manifest.csv'), 'utf8')));
  assert.equal(manifestRows.length, manifestJson.csv.tables.length);
  assert.equal(manifestRows.length, Object.keys(manifestJson.counts).length);

  const inputs = manifestRows.map((row) => ({
    table: row.table,
    csv: readFileSync(join(csvDir, row.file), 'utf8')
  }));
  const packs = plain(g.buildRestoreStatements(inputs));
  packs.forEach((pack) => {
    assert.equal(pack.count, manifestJson.counts[pack.table], 'statement tidak cocok: ' + pack.table);
  });
  const pengajuan = packs.find((p) => p.table === 'pengajuan');
  assert.equal(pengajuan.count, 1);
  assert.match(pengajuan.statements[0], /INSERT INTO "pengajuan"/);
  assert.match(pengajuan.statements[0], /Aisyah Putri/);
});
