import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PROJECT_DIR, argOf, hasFlag } from './lib.mjs';

/**
 * Pembantu mengambil dump D1 dari Cloudflare, lalu (opsional) langsung membukanya.
 *
 * Alur: pastikan login wrangler -> `d1 export --remote` (baca-saja) ->
 * verifikasi dump -> cetak perintah lanjutan atau jalankan `start.mjs`.
 *
 * Contoh:
 *   node tools/backup-app/fetch-backup.mjs
 *   node tools/backup-app/fetch-backup.mjs --open
 *   node tools/backup-app/fetch-backup.mjs --out=/tmp/opencode/backup
 *
 * Skrip ini TIDAK pernah menulis ke Cloudflare dan tidak pernah menghapus berkas.
 */

const WRANGLER = join(PROJECT_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const DEFAULT_DATABASE = 'inhal-poc';
const DEFAULT_CONFIG = 'wrangler.production.toml';
const DEFAULT_OUT = join(PROJECT_DIR, 'local-data', 'backups');

function log(message) {
  console.log('[fetch-backup] ' + message);
}

export function fileStamp(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

export function dumpPath(outDir, now) {
  return join(resolve(outDir), 'inhal-' + fileStamp(now) + '.sql');
}

export function exportArgs({ database, config, output }) {
  return [
    'd1', 'export', String(database),
    '--remote',
    '--config', String(config),
    '--output', String(output),
    '--skip-confirmation'
  ];
}

function runWrangler(args, opts) {
  const result = spawnSync(process.execPath, [WRANGLER, ...args], {
    cwd: PROJECT_DIR,
    stdio: (opts && opts.stdio) || 'inherit',
    encoding: 'utf8'
  });
  if (result.error) throw new Error(result.error.message);
  return result;
}

export function isLoggedIn(whoamiResult) {
  if (!whoamiResult || whoamiResult.status !== 0) return false;
  const text = String(whoamiResult.stdout || '');
  if (/not authenticated|not logged in|You are not authenticated/i.test(text)) return false;
  return /@|Account|account|email/i.test(text);
}

function ensureWrangler() {
  if (!existsSync(WRANGLER)) {
    throw new Error('wrangler belum terpasang. Jalankan `npm ci` di ' + PROJECT_DIR);
  }
}

function ensureLogin() {
  const who = runWrangler(['whoami'], { stdio: 'pipe' });
  if (isLoggedIn(who)) {
    log('login Cloudflare terdeteksi.');
    return;
  }
  const hasToken = Boolean(process.env.CLOUDFLARE_API_TOKEN);
  if (hasToken) {
    throw new Error(
      'CLOUDFLARE_API_TOKEN tidak diterima Cloudflare. Periksa izin token (butuh D1 Edit).'
    );
  }
  log('belum login ke Cloudflare. Menjalankan `wrangler login` (browser akan terbuka)...');
  const login = runWrangler(['login'], {});
  if (login.status !== 0) {
    throw new Error(
      'Login gagal. Alternatif: buat token di https://dash.cloudflare.com/profile/api-tokens ' +
      'lalu jalankan `export CLOUDFLARE_API_TOKEN=<token>` sebelum mengulang perintah ini.'
    );
  }
  const recheck = runWrangler(['whoami'], { stdio: 'pipe' });
  if (!isLoggedIn(recheck)) throw new Error('Login selesai tetapi sesi Cloudflare belum terbaca.');
  log('login berhasil.');
}

function newestSql(dir) {
  if (!existsSync(dir)) return '';
  const files = readdirSync(dir)
    .filter((f) => /\.sql$/i.test(f))
    .map((f) => join(dir, f))
    .filter((f) => statSync(f).isFile())
    .map((f) => ({ f, m: statSync(f).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return files.length ? files[0].f : '';
}

function verify(dump) {
  const script = join(PROJECT_DIR, 'scripts', 'verify-backup.mjs');
  if (!existsSync(script)) {
    log('verify-backup.mjs tidak ditemukan; lewati verifikasi.');
    return true;
  }
  log('memverifikasi dump...');
  const res = spawnSync(process.execPath, [script, dump], { cwd: PROJECT_DIR, encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(String(res.stdout || '') + String(res.stderr || ''));
    throw new Error('Verifikasi dump gagal. Berkas tetap disimpan untuk diperiksa: ' + dump);
  }
  log('verifikasi lolos.');
  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = {
    database: argOf(argv, 'database', DEFAULT_DATABASE),
    config: argOf(argv, 'config', DEFAULT_CONFIG),
    out: argOf(argv, 'out', DEFAULT_OUT),
    port: argOf(argv, 'port', '8790'),
    open: hasFlag(argv, 'open'),
    noVerify: hasFlag(argv, 'no-verify')
  };

  try {
    ensureWrangler();

    const configPath = resolve(PROJECT_DIR, String(opts.config));
    if (!existsSync(configPath)) {
      throw new Error('Konfigurasi tidak ditemukan: ' + configPath);
    }

    if (hasFlag(argv, 'latest')) {
      const found = newestSql(opts.out);
      if (!found) throw new Error('Tidak ada berkas .sql di ' + opts.out);
      log('memakai dump terbaru: ' + found);
      printNext(found, opts);
      return;
    }

    ensureLogin();

    mkdirSync(resolve(opts.out), { recursive: true });
    const output = dumpPath(opts.out, new Date());
    log('mengekspor ' + opts.database + ' (baca-saja) ke ' + output);

    const res = runWrangler(exportArgs({
      database: opts.database,
      config: opts.config,
      output
    }), {});

    if (res.status !== 0) {
      throw new Error(
        'Ekspor gagal (kode ' + res.status + '). Periksa pesan di atas; bila menyebut ' +
        'autentikasi, jalankan `npx wrangler login` lalu ulangi.'
      );
    }
    if (!existsSync(output)) throw new Error('Ekspor selesai tetapi berkas tidak ditemukan: ' + output);

    const size = statSync(output).size;
    log('dump tersimpan: ' + output + ' (' + Math.round(size / 1024) + ' KB)');

    if (!opts.noVerify) verify(output);

    printNext(output, opts);
  } catch (err) {
    console.error('[fetch-backup] ' + (err && err.message ? err.message : String(err)));
    process.exitCode = 1;
  }
}

export function nextCommand(dump, opts) {
  const o = opts || {};
  const parts = ['node tools/backup-app/start.mjs', '--dump=' + dump];
  if (o.port && String(o.port) !== '8790') parts.push('--port=' + o.port);
  return parts.join(' ');
}

function printNext(dump, opts) {
  log('langkah berikutnya:');
  console.log('');
  console.log('  cd ' + PROJECT_DIR);
  console.log('  ' + nextCommand(dump, opts));
  console.log('');
  if (opts.open) {
    log('menjalankan start.mjs...');
    const child = spawnSync(
      process.execPath,
      [join(PROJECT_DIR, 'tools', 'backup-app', 'start.mjs'), '--dump=' + dump, '--port=' + opts.port],
      { cwd: PROJECT_DIR, stdio: 'inherit' }
    );
    process.exitCode = child.status || 0;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { main, newestSql };
