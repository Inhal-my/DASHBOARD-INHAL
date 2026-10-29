import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { encryptBuffer, decryptBuffer } from '../backup-crypto.mjs';
import { selectExpired, remainingEntries, normalizeBridgeUrl, cleanSecretValue } from '../mirror-drive-backup.mjs';
import { PLAN_LIMITS, sizeStatus, stamp } from '../backup-snapshot.mjs';
import { limitState, buildLines } from '../backup-report.mjs';

const PASSPHRASE = 'passphrase-uji-lokal-123';

test('URL Drive Bridge domain Workspace dinormalkan ke bentuk publik', () => {
  const id = 'AKfycbxwaFSaFkMiK5OGNNi4yK8eUVKx1l7KG-Dvs8WalYqwBtRAZSoR4ZtmMXvnMu26V8Ri';
  const publik = 'https://script.google.com/macros/s/' + id + '/exec';

  assert.equal(normalizeBridgeUrl('https://script.google.com/a/macros/umsu.ac.id/s/' + id + '/exec'), publik);
  assert.equal(normalizeBridgeUrl('  https://script.google.com/a/macros/umsu.ac.id/s/' + id + '/exec  '), publik);
  assert.equal(normalizeBridgeUrl(publik), publik);
  assert.equal(normalizeBridgeUrl('https://contoh.test/bridge'), 'https://contoh.test/bridge');
  assert.equal(normalizeBridgeUrl(''), '');
  assert.equal(normalizeBridgeUrl(null), '');
});

test('kutip pembungkus pada nilai secret dibuang sebelum dipakai', () => {
  const id = 'AKfycbxwaFSaFkMiK5OGNNi4yK8eUVKx1l7KG-Dvs8WalYqwBtRAZSoR4ZtmMXvnMu26V8Ri';
  const publik = 'https://script.google.com/macros/s/' + id + '/exec';
  const workspace = 'https://script.google.com/a/macros/umsu.ac.id/s/' + id + '/exec';

  // Kasus nyata: secret tersimpan sebagai `.../exec"` sehingga Google menjawab 404.
  assert.equal(normalizeBridgeUrl(workspace + '"'), publik);
  assert.equal(normalizeBridgeUrl('"' + workspace + '"'), publik);
  assert.equal(normalizeBridgeUrl("'" + workspace + "'"), publik);
  assert.equal(normalizeBridgeUrl(publik + '"'), publik);
  assert.equal(normalizeBridgeUrl('  ' + publik + '  '), publik);

  assert.equal(cleanSecretValue('token-rahasia"'), 'token-rahasia');
  assert.equal(cleanSecretValue('"token-rahasia"'), 'token-rahasia');
  assert.equal(cleanSecretValue('token-rahasia'), 'token-rahasia');
  assert.equal(cleanSecretValue(''), '');
  assert.equal(cleanSecretValue(undefined), '');
});

test('workflow backup tidak memakai konteks runner di env tingkat job', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/backup-d1.yml', import.meta.url), 'utf8');
  const baris = workflow.split(/\r?\n/);

  // `runner` hanya sah di dalam step, sehingga env tingkat job tidak boleh memakainya.
  const awalEnvJob = baris.findIndex((b) => /^ {4}env:\s*$/.test(b));
  assert.notEqual(awalEnvJob, -1, 'blok env tingkat job tidak ditemukan');

  const envJob = [];
  for (let i = awalEnvJob + 1; i < baris.length; i += 1) {
    if (/^ {4}\S/.test(baris[i])) break;
    envJob.push(baris[i]);
  }

  assert.equal(envJob.some((b) => b.includes('runner.')), false, 'runner tidak boleh dipakai di env tingkat job');
  assert.equal(envJob.some((b) => b.includes('BACKUP_DIR')), false, 'BACKUP_DIR diatur pada step, bukan env job');
});

test('enkripsi arsip dapat dibuka kembali dengan frasa sandi yang sama', () => {
  const plain = Buffer.from('dump rahasia ' + 'x'.repeat(120), 'utf8');
  const encrypted = encryptBuffer(plain, PASSPHRASE);

  assert.equal(encrypted.subarray(0, 8).toString('utf8'), 'INHALBK1');
  assert.equal(encrypted.includes(Buffer.from('dump rahasia')), false);
  assert.deepEqual(decryptBuffer(encrypted, PASSPHRASE), plain);
});

test('enkripsi memakai salt dan IV berbeda untuk isi yang sama', () => {
  const plain = Buffer.from('isi sama', 'utf8');
  const first = encryptBuffer(plain, PASSPHRASE);
  const second = encryptBuffer(plain, PASSPHRASE);

  assert.notEqual(first.subarray(8, 24).toString('hex'), second.subarray(8, 24).toString('hex'));
  assert.notEqual(first.subarray(24, 36).toString('hex'), second.subarray(24, 36).toString('hex'));
});

test('dekripsi menolak frasa sandi salah dan berkas yang bukan arsip', () => {
  const encrypted = encryptBuffer(Buffer.from('isi', 'utf8'), PASSPHRASE);

  assert.throws(() => decryptBuffer(encrypted, 'passphrase-uji-lokal-999'), /unable to authenticate|bad decrypt/i);
  assert.throws(() => decryptBuffer(Buffer.from('bukan arsip inhal sama sekali'), PASSPHRASE), /terlalu pendek/i);
  assert.throws(() => decryptBuffer(Buffer.concat([Buffer.from('SALAHHDR'),
    encrypted.subarray(8)]), PASSPHRASE), /Magic header/i);
});

test('frasa sandi kurang dari 12 karakter ditolak', () => {
  assert.throws(() => encryptBuffer(Buffer.from('x'), 'pendek'), /minimal 12 karakter/);
});

test('status ambang ukuran mengikuti batas paket free', () => {
  const limits = PLAN_LIMITS.free;

  assert.equal(sizeStatus(0, limits), 'ok');
  assert.equal(sizeStatus(limits.warnBytes - 1, limits), 'ok');
  assert.equal(sizeStatus(limits.warnBytes, limits), 'warn');
  assert.equal(sizeStatus(limits.maxBytes - 1, limits), 'warn');
  assert.equal(sizeStatus(limits.maxBytes, limits), 'over');
  assert.equal(PLAN_LIMITS.paid.maxBytes > limits.maxBytes, true);
});

test('label backup memakai waktu UTC dengan format YYYYMMDD-HHmm', () => {
  assert.equal(stamp(new Date('2026-10-28T18:05:00Z')), '20261028-1805');
  assert.equal(stamp(new Date('2026-01-02T03:04:00Z')), '20260102-0304');
});

test('retensi memilih arsip kedaluwarsa dan mempertahankan yang masih baru', () => {
  const now = Date.parse('2026-10-28T18:00:00Z');
  const entries = [
    { label: 'BARU', uploadedAt: '2026-10-28T17:00:00Z' },
    { label: 'LAMA', uploadedAt: '2026-10-20T17:00:00Z' },
    { label: 'RUSAK', uploadedAt: 'bukan-tanggal' }
  ];

  assert.deepEqual(selectExpired(entries, 3, now).map((e) => e.label), ['LAMA', 'RUSAK']);
  assert.deepEqual(selectExpired(entries, 30, now).map((e) => e.label), ['RUSAK']);
});

test('indeks hanya menghapus label yang seluruh berkasnya berhasil di-trash', () => {
  const entries = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
  const expired = [{ label: 'A' }, { label: 'B' }];
  const failed = [{ label: 'B', error: 'kuota' }];

  assert.deepEqual(remainingEntries(entries, expired, failed).map((e) => e.label), ['B', 'C']);
});

test('ringkasan run memuat ukuran, integritas, kolom dikecualikan, dan tabel', () => {
  const manifest = {
    label: '20261028-1800',
    database: 'inhal-poc',
    plan: { name: 'free', label: 'Workers Free (500 MB)' },
    source: { bytes: 4096, sha256: 'ABCDEF0123456789FFFF' },
    verification: { integrity: 'ok' },
    totalRows: 3,
    uploads: { present: true, rows: 1, contentBytes: 30000 },
    excludedColumns: { uploads: ['content'] },
    counts: { mahasiswa: 2, uploads: 1 },
    size: {
      estimatedBytes: 1000,
      estimatedHuman: '0.00 MB',
      warnBytes: 314572800,
      maxBytes: 524288000,
      status: 'ok'
    }
  };

  const text = buildLines(manifest, { ok: false, failures: ['duplikat master_kegiatan'] }).join('\n');

  assert.match(text, /## Backup D1 20261028-1800/);
  assert.match(text, /Workers Free \(500 MB\)/);
  assert.match(text, /sha256 `ABCDEF0123456789\.\.\.`/);
  assert.match(text, /Integritas: `ok`/);
  assert.match(text, /Verifikasi bisnis: GAGAL - duplikat master_kegiatan/);
  assert.match(text, /uploads\(content\)/);
  assert.match(text, /\| mahasiswa \| 2 \|/);
  assert.match(text, /\| uploads \| 1 \|/);
});

test('limitState menandai gagal saat ukuran menyentuh batas paket', () => {
  const limits = PLAN_LIMITS.free;

  assert.equal(limitState({ estimatedBytes: 1000, maxBytes: limits.maxBytes, status: 'ok' }), 'ok');
  assert.equal(limitState({ estimatedBytes: limits.warnBytes, maxBytes: limits.maxBytes, status: 'warn' }), 'warn');
  assert.equal(limitState({ estimatedBytes: limits.maxBytes, maxBytes: limits.maxBytes, status: 'over' }), 'fail');
});