import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MIGRATION_PATTERN,
  isValidMigrationName,
  listMigrations,
  parseNameStatus,
  findForbiddenChanges,
  findAddedMigrations,
  buildBaselineSql
} from '../lib/migrations.mjs';
import { getArg } from '../lib/args.mjs';

test('getArg mendukung --nama nilai dan --nama=nilai', () => {
  const argv = ['node', 'x.mjs', '--base', 'origin/main', '--output=/tmp/a.sql'];
  assert.equal(getArg(argv, '--base'), 'origin/main');
  assert.equal(getArg(argv, '--output'), '/tmp/a.sql');
  assert.equal(getArg(argv, '--missing', 'fallback'), 'fallback');
});

test('nama migrasi valid mengikuti tanggal dan slug', () => {
  assert.match('2026-10-18-release-process.sql', MIGRATION_PATTERN);
  assert.equal(isValidMigrationName('2026-10-18-release-process.sql'), true);
  assert.equal(isValidMigrationName('2026-1-1-short.sql'), false);
  assert.equal(isValidMigrationName('2026-10-18-Upper.sql'), false);
  assert.equal(isValidMigrationName('2026-10-18--double.sql'), false);
  assert.equal(isValidMigrationName('catatan.sql'), false);
  assert.equal(isValidMigrationName('2026-10-18-release.txt'), false);
});

test('listMigrations membaca .sql, mengabaikan non-sql, dan mengurutkan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  writeFileSync(join(dir, '2026-10-18-b.sql'), 'SELECT 1;');
  writeFileSync(join(dir, '2026-09-01-a.sql'), 'SELECT 1;');
  writeFileSync(join(dir, 'catatan.txt'), 'bukan migrasi');
  mkdirSync(join(dir, 'sub'));

  const names = listMigrations(dir).map((m) => m.name);
  assert.deepEqual(names, ['2026-09-01-a.sql', '2026-10-18-b.sql']);
});

test('listMigrations menolak nama file yang tidak sesuai pola', () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  writeFileSync(join(dir, 'perbaikan.sql'), 'SELECT 1;');
  assert.throws(() => listMigrations(dir), /perbaikan\.sql/);
});

test('parseNameStatus membaca status git dan findForbiddenChanges menolak M/D/R', () => {
  const output = [
    'A\tmigrations/2026-10-18-baru.sql',
    'M\tmigrations/2026-09-01-lama.sql',
    'M\tnew-code1-cf/migrations/2026-09-02-prefixed.sql',
    'D\tmigrations/2026-01-01-hapus.sql',
    'R100\tmigrations/a.sql\tmigrations/b.sql',
    'M\tsrc/index.js'
  ].join('\n');

  const entries = parseNameStatus(output);
  assert.equal(entries.length, 6);
  assert.deepEqual(
    findForbiddenChanges(entries).map((e) => e.path),
    [
      'migrations/2026-09-01-lama.sql',
      'new-code1-cf/migrations/2026-09-02-prefixed.sql',
      'migrations/2026-01-01-hapus.sql',
      'migrations/a.sql'
    ]
  );
});

test('findAddedMigrations hanya mengambil file migrasi baru', () => {
  const entries = parseNameStatus([
    'A\tmigrations/2026-10-18-baru.sql',
    'M\tmigrations/2026-09-01-lama.sql',
    'A\tsrc/baru.js'
  ].join('\n'));

  assert.deepEqual(findAddedMigrations(entries).map((e) => e.path), [
    'migrations/2026-10-18-baru.sql'
  ]);
});

test('buildBaselineSql membuat tabel pelacak dan INSERT OR IGNORE', () => {
  const sql = buildBaselineSql([
    '2026-09-01-a.sql',
    "2026-10-18-o'brien.sql"
  ]);

  assert.match(sql, /CREATE TABLE IF NOT EXISTS "d1_migrations"/);
  assert.match(sql, /INSERT OR IGNORE INTO "d1_migrations" \(name\) VALUES \('2026-09-01-a\.sql'\);/);
  assert.match(sql, /VALUES \('2026-10-18-o''brien\.sql'\);/);
});
