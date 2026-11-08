import { resolve, join, basename, dirname, isAbsolute, sep } from 'node:path';
import { existsSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Helper murni untuk aplikasi pembuka backup D1 (`tools/backup-app/start.mjs`).
 * Semua keputusan berisiko (path, port, mode tulis, nama sesi) dikumpulkan di
 * sini supaya bisa diuji tanpa menyalakan wrangler.
 *
 * Aturan penting: skrip ini tidak pernah menghapus berkas. Setiap peluncuran
 * memakai folder sesi baru agar impor dump selalu bersih.
 */

const here = dirname(fileURLToPath(import.meta.url));
export const PROJECT_DIR = resolve(here, '..', '..');
export const DEFAULT_PORT = 8790;
export const DEFAULT_DATABASE = 'inhal-poc';
export const DEFAULT_WORK_DIR = join(PROJECT_DIR, 'local-data', 'backup-app');

export function assertLocalOnly(argv) {
  const list = (Array.isArray(argv) ? argv : []).map((a) => String(a));
  const found = list.filter((a) => a === '--remote' || a.startsWith('--remote='));
  if (found.length) {
    throw new Error('Peluncur backup menolak opsi ' + found.join(', ') + '. Aplikasi ini hanya untuk dump lokal.');
  }
  return true;
}

export function argOf(argv, name, fallback) {
  const list = Array.isArray(argv) ? argv : [];
  const prefix = '--' + name + '=';
  const found = list.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

export function hasFlag(argv, name) {
  return (Array.isArray(argv) ? argv : []).includes('--' + name);
}

export function normalizePort(raw, fallback) {
  const n = Number(raw);
  const def = Number(fallback) || DEFAULT_PORT;
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : def;
}

export function parseArgs(argv, env) {
  const e = env || {};
  return {
    dump: argOf(argv, 'dump', ''),
    workDir: argOf(argv, 'work-dir', DEFAULT_WORK_DIR),
    port: normalizePort(argOf(argv, 'port', ''), DEFAULT_PORT),
    database: argOf(argv, 'database', DEFAULT_DATABASE),
    open: !hasFlag(argv, 'no-open'),
    readOnly: !hasFlag(argv, 'allow-write'),
    reuse: argOf(argv, 'reuse', ''),
    passphrase: argOf(argv, 'passphrase', e.BACKUP_PASSPHRASE || '')
  };
}

export function validateDumpPath(dump, cwd) {
  const raw = String(dump || '').trim();
  if (!raw) throw new Error('--dump=<berkas> wajib diisi (berkas .sql hasil ekspor D1).');
  const p = isAbsolute(raw) ? raw : resolve(cwd || process.cwd(), raw);
  if (!existsSync(p)) throw new Error('Berkas dump tidak ditemukan: ' + p);
  if (!statSync(p).isFile()) throw new Error('--dump harus menunjuk ke berkas, bukan folder: ' + p);
  if (/\.enc$/i.test(p)) {
    throw new Error('Berkas .enc harus didekripsi dulu: node scripts/decrypt-backup.mjs <arsip.enc> --out=<dump.sql>');
  }
  if (!/\.sql$/i.test(p)) throw new Error('Hanya berkas .sql yang didukung. Diberikan: ' + p);
  return resolve(p);
}

export function validateWorkDir(workDir) {
  const w = resolve(String(workDir || DEFAULT_WORK_DIR));
  const root = PROJECT_DIR + sep;
  if (w !== PROJECT_DIR && !w.startsWith(root)) {
    throw new Error('--work-dir harus di dalam folder proyek: ' + PROJECT_DIR);
  }
  return w;
}

export function stamp(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    '-' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds())
  );
}

export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.sql$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'dump';
}

/**
 * Tentukan folder sesi. Tanpa penghapusan: bila nama sudah dipakai, tambah
 * akhiran -2, -3, dst. `--reuse=<nama>` memakai folder yang ada apa adanya.
 */
export function sessionDir(workDir, dumpPath, options) {
  const opts = options || {};
  const base = join(workDir, stamp(opts.now) + '-' + slugify(basename(String(dumpPath))));
  if (opts.reuse) {
    const reuseTarget = resolve(join(workDir, String(opts.reuse)));
    if (!reuseTarget.startsWith(resolve(workDir) + sep)) {
      throw new Error('--reuse harus berupa nama folder di dalam work-dir.');
    }
    if (!existsSync(reuseTarget)) throw new Error('Folder --reuse tidak ditemukan: ' + reuseTarget);
    return reuseTarget;
  }
  let candidate = base;
  let i = 2;
  while (existsSync(candidate)) {
    candidate = base + '-' + i;
    i += 1;
  }
  return candidate;
}

export function buildD1Args({ database, workDir, file }) {
  return [
    'wrangler', 'd1', 'execute', String(database || DEFAULT_DATABASE),
    '--local',
    '--persist-to', String(workDir),
    '--file', String(file)
  ];
}

export function buildDevArgs({ workDir, port, ip, readOnly }) {
  return [
    'wrangler', 'dev',
    '--local',
    '--persist-to', String(workDir),
    '--ip', String(ip || '127.0.0.1'),
    '--port', String(normalizePort(port, DEFAULT_PORT)),
    '--config', join(here, 'wrangler.toml'),
    '--var', 'BACKUP_APP_READONLY:' + (readOnly ? 'true' : 'false')
  ];
}

export function appUrl(port) {
  return 'http://127.0.0.1:' + normalizePort(port, DEFAULT_PORT);
}

export function healthUrl(port) {
  return appUrl(port) + '/api/health';
}

export { READ_ONLY_RPC, isReadOnlyRpc, blockedRequest } from './guard.mjs';

export function describePlan(opts, dir) {
  return [
    'dump     : ' + opts.dump,
    'database : ' + opts.database,
    'sesi     : ' + dir,
    'alamat   : ' + appUrl(opts.port),
    'mode     : ' + (opts.readOnly ? 'baca-saja' : 'izinkan-tulis')
  ].join('\n');
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function copyDump(dump, dir) {
  const target = join(dir, 'backup.sql');
  copyFileSync(dump, target);
  return target;
}
