import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertLocalOnly, parseArgs, validateDumpPath, validateWorkDir, sessionDir,
  buildD1Args, buildDevArgs, appUrl, healthUrl, describePlan, PROJECT_DIR,
  READ_ONLY_RPC, isReadOnlyRpc, blockedRequest
} from '../../tools/backup-app/lib.mjs';

function tmpDump(name) {
  const dir = mkdtempSync(join(tmpdir(), 'inhal-backup-app-'));
  const file = join(dir, name || 'dump.sql');
  writeFileSync(file, 'CREATE TABLE t (a TEXT);\n');
  return file;
}

test('peluncur backup menolak opsi --remote', () => {
  assert.equal(assertLocalOnly([]), true);
  assert.throws(() => assertLocalOnly(['--remote']), /menolak opsi --remote/);
  assert.throws(() => assertLocalOnly(['--remote=true']), /menolak opsi --remote/);
});

test('parseArgs memakai default aman', () => {
  const opts = parseArgs([], {});
  assert.equal(opts.port, 8790);
  assert.equal(opts.database, 'inhal-poc');
  assert.equal(opts.open, true);
  assert.equal(opts.readOnly, true);
  assert.equal(opts.reuse, '');
  assert.match(opts.workDir, /local-data\/backup-app$/);

  const custom = parseArgs(
    ['--dump=/tmp/x.sql', '--port=9001', '--no-open', '--allow-write', '--reuse=abc', '--work-dir=/tmp/p'],
    { BACKUP_PASSPHRASE: 'rahasia' }
  );
  assert.equal(custom.dump, '/tmp/x.sql');
  assert.equal(custom.port, 9001);
  assert.equal(custom.open, false);
  assert.equal(custom.readOnly, false);
  assert.equal(custom.reuse, 'abc');
  assert.equal(custom.workDir, '/tmp/p');
  assert.equal(custom.passphrase, 'rahasia');
});

test('port tidak valid kembali ke default', () => {
  assert.equal(parseArgs(['--port=0']).port, 8790);
  assert.equal(parseArgs(['--port=abc']).port, 8790);
  assert.equal(parseArgs(['--port=70000']).port, 8790);
});

test('validateDumpPath hanya menerima .sql absolut yang ada', () => {
  const ok = tmpDump();
  assert.equal(validateDumpPath(ok), ok);
  assert.equal(validateDumpPath('dump.sql', join(ok, '..')), ok);

  assert.throws(() => validateDumpPath(''), /--dump=<berkas> wajib/);
  assert.throws(() => validateDumpPath('relatif-tidak-ada.sql'), /tidak ditemukan/);
  assert.throws(() => validateDumpPath('/tmp/tidak-ada-xyz.sql'), /tidak ditemukan/);
  assert.throws(() => validateDumpPath('/tmp'), /menunjuk ke berkas/);

  const enc = tmpDump('arsip.sql.enc');
  assert.throws(() => validateDumpPath(enc), /decrypt-backup/);
  const txt = tmpDump('arsip.txt');
  assert.throws(() => validateDumpPath(txt), /Hanya berkas \.sql/);
});

test('validateWorkDir menahan penulisan di luar folder proyek', () => {
  assert.equal(validateWorkDir(PROJECT_DIR), PROJECT_DIR);
  assert.equal(validateWorkDir(join(PROJECT_DIR, 'local-data', 'x')), join(PROJECT_DIR, 'local-data', 'x'));
  assert.throws(() => validateWorkDir('/tmp/di-luar'), /di dalam folder proyek/);
  assert.throws(() => validateWorkDir(PROJECT_DIR + '-lain'), /di dalam folder proyek/);
});

test('folder sesi unik tanpa menghapus apa pun', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'inhal-sessions-'));
  const dump = tmpDump();
  const now = new Date('2026-11-08T05:15:00Z');

  const first = sessionDir(workDir, dump, { now });
  assert.match(first, /20261108-051500-dump$/);
  mkdirSync(first);
  const second = sessionDir(workDir, dump, { now });
  assert.equal(second, first + '-2');
  mkdirSync(second);
  assert.equal(sessionDir(workDir, dump, { now }), first + '-3');
});

test('--reuse hanya menerima folder di dalam work-dir', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'inhal-reuse-'));
  const existing = join(workDir, 'sesi-lama');
  mkdirSync(existing);

  assert.equal(sessionDir(workDir, '', { reuse: 'sesi-lama' }), existing);
  assert.throws(() => sessionDir(workDir, '', { reuse: 'tidak-ada' }), /tidak ditemukan/);
  assert.throws(() => sessionDir(workDir, '', { reuse: '../keluar' }), /di dalam work-dir/);
});

test('perintah wrangler selalu lokal dan menunjuk folder sesi', () => {
  const d1 = buildD1Args({ database: 'inhal-poc', workDir: '/p', file: '/p/backup.sql' });
  assert.deepEqual(d1, [
    'wrangler', 'd1', 'execute', 'inhal-poc',
    '--local', '--persist-to', '/p', '--file', '/p/backup.sql'
  ]);
  assert.equal(d1.includes('--remote'), false);

  const dev = buildDevArgs({ workDir: '/p', port: 8790, readOnly: true });
  assert.equal(dev.includes('--local'), true);
  assert.equal(dev.includes('--remote'), false);
  assert.equal(dev[dev.indexOf('--ip') + 1], '127.0.0.1');
  assert.equal(dev[dev.indexOf('--port') + 1], '8790');
  assert.equal(dev[dev.indexOf('--var') + 1], 'BACKUP_APP_READONLY:true');
  assert.match(dev[dev.indexOf('--config') + 1], /tools\/backup-app\/wrangler\.toml$/);
});

test('URL lokal dan ringkasan rencana', () => {
  assert.equal(appUrl(8790), 'http://127.0.0.1:8790');
  assert.equal(healthUrl(8790), 'http://127.0.0.1:8790/api/health');
  assert.equal(appUrl(0), 'http://127.0.0.1:8790');
  const plan = describePlan({ dump: '/a.sql', database: 'inhal-poc', port: 8790, readOnly: true }, '/sesi');
  assert.match(plan, /baca-saja/);
  assert.match(plan, /\/a\.sql/);
});

test('daftar baca-saja memuat RPC tampilan dan menolak RPC tulis', () => {
  for (const fn of ['authenticateAdmin', 'logoutSession', 'getActivityLog', 'getPengajuanList', 'baAdminGet']) {
    assert.equal(isReadOnlyRpc(fn), true, fn + ' seharusnya diizinkan');
  }
  for (const fn of ['deletePengajuanAdmin', 'updatePengajuanStatus', 'sendFinalEmail', 'saveMahasiswa', '']) {
    assert.equal(isReadOnlyRpc(fn), false, fn + ' seharusnya ditolak');
  }
  assert.equal(READ_ONLY_RPC.length, new Set(READ_ONLY_RPC).size, 'tidak boleh ada duplikat');
});

test('penjaga memblokir endpoint tulis dan RPC tulis', () => {
  assert.equal(blockedRequest('GET', '/api/health', ''), '');
  assert.equal(blockedRequest('POST', '/api/rpc', 'getActivityLog'), '');
  assert.match(blockedRequest('POST', '/api/rpc', 'deletePengajuanAdmin'), /tidak diizinkan/);
  assert.match(blockedRequest('POST', '/api/rpc', ''), /\(kosong\)/);
  assert.match(blockedRequest('POST', '/api/pengajuan', ''), /\/api\/pengajuan/);
  assert.match(blockedRequest('POST', '/api/portal/upload', ''), /\/api\/portal\/upload/);
  assert.match(blockedRequest('POST', '/api/database-export', ''), /\/api\/database-export/);
  assert.equal(blockedRequest('GET', '/api/pengajuan', ''), '');
});

test('dump contoh dapat diimpor dan berisi data dashboard', async () => {
  const { buildSampleDump } = await import('../../tools/backup-app/sample-dump.mjs');
  const { DatabaseSync } = await import('node:sqlite');

  const sql = buildSampleDump({ password: 'uji-lokal-123' });
  assert.match(sql, /INSERT INTO "pengajuan"/);
  assert.match(sql, /CREATE TABLE/);

  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  const count = (t) => Number(db.prepare('SELECT COUNT(*) AS n FROM "' + t + '"').get().n);

  assert.equal(count('pengajuan'), 4);
  assert.equal(count('detail_kegiatan'), 4);
  assert.equal(count('berita_acara'), 1);
  assert.equal(count('audit_log'), 4);
  assert.equal(count('log_upload'), 1);

  const admin = db.prepare('SELECT password, nama FROM admin WHERE id = 1').get();
  assert.equal(admin.password, 'uji-lokal-123');
  assert.equal(admin.nama, 'Admin Demo');

  const statuses = db.prepare('SELECT status, COUNT(*) AS n FROM pengajuan GROUP BY status ORDER BY status').all()
    .map((r) => r.status + '=' + r.n);
  assert.deepEqual(statuses, ['ACC=1', 'Ditolak=1', 'Menunggu=2']);
  db.close();
});

test('dump contoh tidak memuat kredensial nyata dan konsisten dengan schema', async () => {
  const { buildSampleDump } = await import('../../tools/backup-app/sample-dump.mjs');
  const sql = buildSampleDump();
  assert.equal(/pbkdf2\$/.test(sql), false, 'dump contoh tidak boleh memuat hash produksi');
  assert.equal(/8f412848-d213-4bb3-aeb7-0aff221f9ee3/.test(sql), false, 'tidak boleh memuat id database produksi');
  assert.doesNotMatch(sql, /BEGIN TRANSACTION|COMMIT;/, 'harus bisa dieksekusi ulang oleh D1 lokal');
});

test('fetch-backup: argumen ekspor selalu --remote baca-saja dan nama berkas berpola tanggal', async () => {
  const { exportArgs, dumpPath, fileStamp, isLoggedIn, nextCommand } = await import('../../tools/backup-app/fetch-backup.mjs');
  const args = exportArgs({ database: 'inhal-poc', config: 'wrangler.production.toml', output: '/tmp/x.sql' });
  assert.deepEqual(args, [
    'd1', 'export', 'inhal-poc', '--remote',
    '--config', 'wrangler.production.toml', '--output', '/tmp/x.sql', '--skip-confirmation'
  ]);
  assert.equal(args.includes('--local'), false, 'ekspor harus dari database remote');

  const now = new Date(2026, 10, 8, 9, 5, 7);
  assert.equal(fileStamp(now), '20261108-090507');
  assert.match(dumpPath('/tmp/out', now), /inhal-20261108-090507\.sql$/);

  assert.equal(isLoggedIn({ status: 0, stdout: 'You are not authenticated. Please run `wrangler login`.' }), false);
  assert.equal(isLoggedIn({ status: 1, stdout: '' }), false);
  assert.equal(isLoggedIn({ status: 0, stdout: 'Getting User settings...\nAccount Name: Inhal\nUser: a@b.c' }), true);

  const cmd = nextCommand('/tmp/a b.sql', { port: '8791' });
  assert.match(cmd, /start\.mjs --dump=\/tmp\/a b\.sql --port=8791$/);
  assert.equal(nextCommand('/tmp/a.sql', { port: '8790' }).includes('--port'), false);
});
