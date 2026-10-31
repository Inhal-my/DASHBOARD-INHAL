import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertLocalOnly, browserCommand, buildD1Args, buildDevArgs, healthUrl, parseArgs, pickLatestDump
} from '../local-app.mjs';

test('parseArgs memakai default aman untuk peluncur lokal', () => {
  const opts = parseArgs([]);
  assert.equal(opts.port, 8787);
  assert.equal(opts.database, 'inhal-poc');
  assert.equal(opts.open, true);
  assert.equal(opts.reset, false);
  assert.equal(opts.importDump, true);
  assert.equal(opts.dump, '');
  assert.match(opts.persistTo, /local-data$/);

  const custom = parseArgs(['--port=9000', '--dump=/tmp/x.sql', '--no-open', '--reset', '--no-import', '--database=demo', '--persist-to=/tmp/p']);
  assert.equal(custom.port, 9000);
  assert.equal(custom.dump, '/tmp/x.sql');
  assert.equal(custom.open, false);
  assert.equal(custom.reset, true);
  assert.equal(custom.importDump, false);
  assert.equal(custom.database, 'demo');
  assert.equal(custom.persistTo, '/tmp/p');
});

test('parseArgs menormalkan port tidak valid ke default', () => {
  assert.equal(parseArgs(['--port=0']).port, 8787);
  assert.equal(parseArgs(['--port=abc']).port, 8787);
  assert.equal(parseArgs(['--port=99999']).port, 8787);
});

test('peluncur selalu lokal dan menolak --remote', () => {
  assert.equal(assertLocalOnly([]), true);
  assert.throws(() => assertLocalOnly(['--remote']), /menolak opsi --remote/);
  assert.throws(() => assertLocalOnly(['--remote=true']), /menolak opsi --remote/);

  const d1 = buildD1Args({ database: 'inhal-poc', persistTo: '/tmp/p', file: '/tmp/schema.sql' });
  assert.deepEqual(d1, ['wrangler', 'd1', 'execute', 'inhal-poc', '--local', '--persist-to', '/tmp/p', '--file', '/tmp/schema.sql']);
  assert.equal(d1.includes('--remote'), false);

  const dev = buildDevArgs({ persistTo: '/tmp/p', port: 8787 });
  assert.deepEqual(dev, ['wrangler', 'dev', '--local', '--persist-to', '/tmp/p', '--port', '8787']);
  assert.equal(dev.includes('--remote'), false);
});

test('helper peluncur membentuk URL dan perintah browser', () => {
  assert.equal(healthUrl(8787), 'http://127.0.0.1:8787/api/health');
  assert.equal(healthUrl(0), 'http://127.0.0.1:8787/api/health');
  assert.deepEqual(browserCommand('darwin', 'http://x'), { cmd: 'open', args: ['http://x'] });
  assert.deepEqual(browserCommand('win32', 'http://x'), { cmd: 'cmd', args: ['/c', 'start', '', 'http://x'] });
  assert.deepEqual(browserCommand('linux', 'http://x'), { cmd: 'xdg-open', args: ['http://x'] });
});

test('pickLatestDump memilih berkas .sql terbaru dan aman saat kosong', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inhal-dump-'));
  assert.equal(pickLatestDump(dir), '');
  assert.equal(pickLatestDump(join(dir, 'tidak-ada')), '');
  assert.equal(pickLatestDump(''), '');
  writeFileSync(join(dir, 'lama.sql'), '-- lama');
  writeFileSync(join(dir, 'catatan.txt'), 'x');
  writeFileSync(join(dir, 'baru.sql'), '-- baru');
  const picked = pickLatestDump(dir);
  assert.match(picked, /\.sql$/);
  assert.match(picked, /(lama|baru)\.sql$/);
});
