import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildVitestArgs,
  isMirrorSource,
  lockFingerprint,
  needsInstall,
  pathHasSpace,
  resolveMirrorDir,
  shouldKeepInMirror
} from '../lib/test-local.mjs';

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('pathHasSpace mendeteksi spasi pada path', () => {
  assert.equal(pathHasSpace('D:\\app\\inhal dashboard-github\\DASHBOARD-INHAL'), true);
  assert.equal(pathHasSpace('D:\\tmp\\inhal-cf'), false);
  assert.equal(pathHasSpace(''), false);
});

test('resolveMirrorDir memakai default per platform dan menghormati override', () => {
  assert.equal(resolveMirrorDir({ platform: 'win32', env: {} }), 'D:\\tmp\\inhal-cf');
  assert.equal(resolveMirrorDir({ platform: 'linux', env: {} }), '/tmp/inhal-cf');
  assert.equal(
    resolveMirrorDir({ platform: 'win32', env: { INHAL_TEST_MIRROR_BASE: 'C:\\work' } }),
    'C:\\work\\inhal-cf'
  );
  assert.equal(
    resolveMirrorDir({ platform: 'win32', env: { INHAL_TEST_MIRROR: 'D:\\mirror\\inhal-cf' } }),
    'D:\\mirror\\inhal-cf'
  );
});

test('isMirrorSource menolak node_modules, cache wrangler, dan berkas rahasia', () => {
  assert.equal(isMirrorSource('src/index.js'), true);
  assert.equal(isMirrorSource(''), true);
  assert.equal(isMirrorSource('.'), true);
  assert.equal(isMirrorSource('node_modules/vitest/index.js'), false);
  assert.equal(isMirrorSource('.wrangler\\tmp\\x'), false);
  assert.equal(isMirrorSource('test\\node_modules\\a.js'), false);
  assert.equal(isMirrorSource('.dev.vars'), false);
  assert.equal(isMirrorSource('coverage/index.html'), false);
});

test('shouldKeepInMirror mempertahankan cache dan node_modules mirror', () => {
  assert.equal(shouldKeepInMirror('node_modules'), false);
  assert.equal(shouldKeepInMirror('.wrangler'), false);
  assert.equal(shouldKeepInMirror('.git'), false);
  assert.equal(shouldKeepInMirror('src'), true);
  assert.equal(shouldKeepInMirror('.inhal-test-lock'), true);
});

test('lockFingerprint stabil dan berbeda saat lock berubah', () => {
  const a = lockFingerprint('{"name":"x"}');
  assert.equal(a, lockFingerprint('{"name":"x"}'));
  assert.notEqual(a, lockFingerprint('{"name":"y"}'));
  assert.equal(lockFingerprint('', ''), '');
  assert.equal(lockFingerprint('', '{"name":"x"}'), lockFingerprint('{"name":"x"}'));
});

test('needsInstall memaksa instalasi saat lock hilang atau fingerprint berbeda', () => {
  assert.equal(needsInstall({ hasLock: true, installedFingerprint: 'a', currentFingerprint: 'a' }), false);
  assert.equal(needsInstall({ hasLock: true, installedFingerprint: 'a', currentFingerprint: 'b' }), true);
  assert.equal(needsInstall({ hasLock: true, installedFingerprint: '', currentFingerprint: 'b' }), true);
  assert.equal(needsInstall({ hasLock: false, installedFingerprint: 'b', currentFingerprint: 'b' }), true);
});

test('buildVitestArgs selalu menjalankan mode run sekali saja', () => {
  assert.deepEqual(buildVitestArgs([]), ['run']);
  assert.deepEqual(buildVitestArgs(['--', 'test/read-ba-audit.test.js']), ['run', 'test/read-ba-audit.test.js']);
  assert.deepEqual(buildVitestArgs(['run', 'test/x.test.js']), ['run', 'test/x.test.js']);
  assert.deepEqual(buildVitestArgs(['watch']), ['watch']);
});

test('package.json mendaftarkan skrip test:local', () => {
  const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['test:local'], 'node scripts/test-local.mjs');
});