#!/usr/bin/env node
// Jalankan `vitest run` dengan aman di Windows walau path proyek memuat spasi.
//
// Pemakaian:
//   npm run test:local                 # seluruh suite
//   npm run test:local -- test/read-ba-audit.test.js
//
// Bila path proyek sudah tanpa spasi, test dijalankan langsung. Bila memuat spasi,
// proyek disalin ke direktori mirror tanpa spasi (default D:\tmp\inhal-cf) dan
// dependensi disiapkan sekali di sana (di-cache lewat fingerprint package-lock.json).
// Override lokasi mirror dengan env INHAL_TEST_MIRROR (path penuh) atau
// INHAL_TEST_MIRROR_BASE (direktori induk).

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildVitestArgs,
  isMirrorSource,
  lockFingerprint,
  needsInstall,
  pathHasSpace,
  resolveMirrorDir,
  shouldKeepInMirror
} from './lib/test-local.mjs';

const STAMP_FILE = '.inhal-test-lock';
const LOCK_FILE = '.inhal-test-running';
const LOCK_STALE_MS = 30 * 60 * 1000;

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const userArgs = process.argv.slice(2);

function log(message) {
  console.log(`[test:local] ${message}`);
}

function fail(message) {
  console.error(`[test:local] ${message}`);
  process.exit(1);
}

function runVitest(dir) {
  const bin = join(dir, 'node_modules', 'vitest', 'vitest.mjs');
  if (!existsSync(bin)) fail(`vitest tidak ditemukan di ${bin}. Jalankan dulu instalasi dependensi.`);
  const result = spawnSync(process.execPath, [bin, ...buildVitestArgs(userArgs)], {
    cwd: dir,
    stdio: 'inherit'
  });
  if (result.error) fail(result.error.message);
  return result.status === null ? 1 : result.status;
}

function installDependencies(dir) {
  log(`memasang dependensi di ${dir}`);
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const installArgs = existsSync(join(dir, 'package-lock.json'))
    ? ['ci', '--no-audit', '--no-fund']
    : ['install', '--no-audit', '--no-fund'];
  const result = spawnSync(npmCmd, installArgs, { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`instalasi dependensi gagal (kode ${result.status}).`);
}

function currentFingerprint() {
  const lockPath = join(projectDir, 'package-lock.json');
  const pkgPath = join(projectDir, 'package.json');
  const lockContent = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : '';
  const pkgContent = existsSync(pkgPath) ? readFileSync(pkgPath, 'utf8') : '';
  return { hasLock: existsSync(lockPath), fingerprint: lockFingerprint(lockContent, pkgContent) };
}

function readStamp(dir) {
  const stampPath = join(dir, STAMP_FILE);
  if (!existsSync(stampPath)) return '';
  try {
    return readFileSync(stampPath, 'utf8').trim();
  } catch {
    return '';
  }
}

function cleanMirror(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === STAMP_FILE || entry === LOCK_FILE || !shouldKeepInMirror(entry)) continue;
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function acquireLock(dir) {
  const lockPath = join(dir, LOCK_FILE);
  if (existsSync(lockPath)) {
    let age = Infinity;
    try {
      age = Date.now() - new Date(readFileSync(lockPath, 'utf8').trim()).getTime();
    } catch {
      age = Infinity;
    }
    if (Number.isFinite(age) && age < LOCK_STALE_MS) {
      fail(`mirror ${dir} sedang dipakai proses lain. Tunggu sampai selesai atau hapus ${LOCK_FILE}.`);
    }
    rmSync(lockPath, { force: true });
  }
  writeFileSync(lockPath, new Date().toISOString(), 'utf8');
}

function releaseLock(dir) {
  rmSync(join(dir, LOCK_FILE), { force: true });
}

function syncMirror(dir) {
  cpSync(projectDir, dir, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = relative(projectDir, src);
      return isMirrorSource(rel);
    }
  });
}

function main() {
  const needsMirror = pathHasSpace(projectDir) && !process.env.INHAL_TEST_MIRROR;
  if (!needsMirror) {
    log(`menjalankan test di ${projectDir}`);
    process.exit(runVitest(projectDir));
  }

  const mirrorDir = resolve(resolveMirrorDir());
  if (pathHasSpace(mirrorDir)) {
    fail(`mirror ${mirrorDir} masih memuat spasi. Set INHAL_TEST_MIRROR ke path tanpa spasi.`);
  }

  log(`path proyek memuat spasi; memakai mirror ${mirrorDir}`);
  mkdirSync(mirrorDir, { recursive: true });
  acquireLock(mirrorDir);
  let status = 1;
  try {
    cleanMirror(mirrorDir);
    syncMirror(mirrorDir);

    const { hasLock, fingerprint } = currentFingerprint();
    const installed = readStamp(mirrorDir);
    if (needsInstall({ hasLock, installedFingerprint: installed, currentFingerprint: fingerprint })) {
      installDependencies(mirrorDir);
      writeFileSync(join(mirrorDir, STAMP_FILE), `${fingerprint}\n`, 'utf8');
    } else {
      log('dependensi mirror masih cocok, lewati instalasi');
    }

    status = runVitest(mirrorDir);
  } finally {
    releaseLock(mirrorDir);
  }
  process.exit(status);
}

main();
