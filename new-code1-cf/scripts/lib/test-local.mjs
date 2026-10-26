// Helper untuk menjalankan test dari direktori tanpa spasi.
//
// Latar belakang: `@cloudflare/vitest-pool-workers` 0.5.x memanggil `import()`
// dengan URL `file:///...` yang mengandung `%20` ketika path proyek memuat spasi.
// workerd menolak URL tersebut sehingga seluruh suite gagal sebelum test berjalan.
// Solusinya: salin proyek ke direktori tanpa spasi lalu jalankan vitest di sana.

import { createHash } from 'node:crypto';

export function pathHasSpace(value) {
  return /\s/.test(String(value || ''));
}

export function resolveMirrorDir({ platform = process.platform, env = process.env } = {}) {
  const override = String(env.INHAL_TEST_MIRROR || '').trim();
  if (override) return override;
  const base = String(env.INHAL_TEST_MIRROR_BASE || '').trim();
  if (platform === 'win32') {
    return `${base || 'D:\\tmp'}\\inhal-cf`;
  }
  return `${base || '/tmp'}/inhal-cf`;
}

const SKIP_TOP_LEVEL = ['node_modules', '.wrangler', '.git'];

const SKIP_ANY = [
  'node_modules',
  '.wrangler',
  '.git',
  'coverage',
  'test-results',
  'playwright-report',
  '.dev.vars',
  '.env'
];

export function isMirrorSource(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized || normalized === '.') return true;
  const segments = normalized.split('/');
  if (segments.some((s) => SKIP_ANY.includes(s))) return false;
  return true;
}

export function shouldKeepInMirror(entryName) {
  return !SKIP_TOP_LEVEL.includes(String(entryName || ''));
}

export function lockFingerprint(lockContent, fallbackContent = '') {
  const content = String(lockContent || fallbackContent || '');
  if (!content) return '';
  return createHash('sha256').update(content).digest('hex');
}

export function needsInstall({ hasLock, installedFingerprint, currentFingerprint }) {
  if (!hasLock) return true;
  if (!installedFingerprint) return true;
  return installedFingerprint !== currentFingerprint;
}

export function buildVitestArgs(userArgs = []) {
  const args = Array.isArray(userArgs) ? userArgs.slice() : [];
  while (args[0] === '--') args.shift();
  if (args[0] === 'run' || args[0] === 'watch') return args;
  return ['run', ...args];
}
