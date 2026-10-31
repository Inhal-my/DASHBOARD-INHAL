import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = join(here, '..', '..');
const viewerDir = join(projectDir, 'tools', 'backup-viewer');

function phpAvailable() {
  const probe = spawnSync('php', ['-v'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

function readViewer() {
  return {
    index: readFileSync(join(viewerDir, 'index.php'), 'utf8'),
    lib: readFileSync(join(viewerDir, 'lib', 'csv.php'), 'utf8'),
    guard: readFileSync(join(viewerDir, 'lib', 'guard.php'), 'utf8')
  };
}

test('viewer bersifat read-only: tanpa penulisan berkas dan tanpa SQL', () => {
  const { index, lib, guard } = readViewer();
  const forbidden = ['file_put_contents', 'fwrite', 'unlink(', 'rename(', 'mkdir(', 'move_uploaded_file', 'curl_', 'mysqli', 'PDO', 'shell_exec'];
  for (const needle of forbidden) {
    assert.equal(index.includes(needle), false, 'index.php memuat ' + needle);
    assert.equal(lib.includes(needle), false, 'csv.php memuat ' + needle);
    assert.equal(guard.includes(needle), false, 'guard.php memuat ' + needle);
  }
});

test('viewer membatasi akses ke loopback dan memvalidasi nama tabel', () => {
  const { index, lib, guard } = readViewer();
  assert.match(guard, /127\./);
  assert.match(guard, /::1/);
  assert.match(guard, /403/);
  assert.match(guard, /X-Frame-Options/);
  assert.match(guard, /no-store/);
  assert.match(lib, /preg_match/);
  assert.match(index, /bv_safe_table\(\$label\)/);
  assert.match(lib, /bv_safe_table/);
  assert.match(lib, /fgetcsv/);
});

test('viewer membaca manifest.csv hasil generator sungguhan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inhal-viewer-'));
  const dump = join(dir, 'drill.sql');
  writeFileSync(dump, readFileSync(join(projectDir, 'schema.sql'), 'utf8') +
    "\nINSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T00:00:00','INHAL-1','2201010001','Aisyah Putri','A','SGD','ACC');\n");

  execFileSync(process.execPath, ['scripts/backup-snapshot.mjs', dump, '--out=' + join(dir, 'out'), '--label=VIEWER', '--plan=free'], {
    cwd: projectDir, stdio: 'pipe'
  });

  const manifest = JSON.parse(readFileSync(join(dir, 'out', 'manifest.json'), 'utf8'));
  const csvDir = join(dir, 'out', manifest.csv.dir);

  // Struktur yang diharapkan viewer: data/<label>/manifest.csv + <tabel>.csv
  const manifestCsv = readFileSync(join(csvDir, 'manifest.csv'), 'utf8').trimEnd().split('\r\n');
  assert.equal(manifestCsv[0], 'tabel,file,baris,kolom,bytes,sha256');
  assert.equal(manifestCsv.length, manifest.csv.tables.length + 1);

  const dataDir = join(dir, 'viewer-data', 'VIEWER');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'manifest.csv'), readFileSync(join(csvDir, 'manifest.csv')));
  writeFileSync(join(dataDir, 'pengajuan.csv'), readFileSync(join(csvDir, 'pengajuan.csv')));

  // Setiap tabel di manifest punya berkas CSV dengan jumlah baris yang sama.
  manifest.csv.tables.forEach((entry) => {
    const rows = readFileSync(join(csvDir, entry.file), 'utf8').trimEnd().split('\r\n');
    assert.equal(rows.length - 1, manifest.counts[entry.table], 'baris CSV tidak cocok: ' + entry.table);
    assert.equal(Number(entry.columns), rows[0].split(',').length, 'jumlah kolom tidak cocok: ' + entry.table);
  });
});

test('berkas PHP lolos lint bila PHP tersedia', (t) => {
  if (!phpAvailable()) {
    t.skip('PHP tidak terpasang di mesin ini; lint dilewati.');
    return;
  }
  ['index.php', 'lib/csv.php', 'lib/guard.php'].forEach((file) => {
    execFileSync('php', ['-l', join(viewerDir, file)], { stdio: 'pipe' });
  });
});

test('viewer punya README, pelindung folder data, dan entri gitignore', () => {
  const readme = readFileSync(join(viewerDir, 'README.md'), 'utf8');
  assert.match(readme, /php -S 127\.0\.0\.1/);
  assert.match(readme, /XAMPP/);
  const htaccess = readFileSync(join(viewerDir, 'data', '.htaccess'), 'utf8');
  assert.match(htaccess, /Require all denied/);
  const ignore = readFileSync(join(projectDir, '.gitignore'), 'utf8');
  assert.match(ignore, /local-data\//);
  assert.match(ignore, /tools\/backup-viewer\/data\/\*/);
  assert.match(ignore, /\.sqlite/);
});
