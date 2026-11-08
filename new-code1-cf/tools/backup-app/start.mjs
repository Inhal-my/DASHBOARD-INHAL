import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  PROJECT_DIR, assertLocalOnly, parseArgs, validateDumpPath, validateWorkDir,
  sessionDir, buildD1Args, buildDevArgs, appUrl, healthUrl, describePlan,
  ensureDir, copyDump
} from './lib.mjs';

/**
 * Aplikasi pembuka backup D1 untuk admin.
 *
 * Alur: salin dump -> impor ke D1 lokal di folder sesi baru -> jalankan Worker
 * asli (`tools/backup-app/worker.js`) dengan penjaga baca-saja -> buka browser.
 *
 * Contoh:
 *   node tools/backup-app/start.mjs --dump=/path/absolut/inhal-poc.sql
 *   node tools/backup-app/start.mjs --dump=... --no-open --port=8791
 *   node tools/backup-app/start.mjs --reuse=20261108-051500-inhal-poc
 *
 * Skrip tidak pernah menghapus berkas dan tidak pernah menyentuh Cloudflare.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CONFIG = join(here, 'wrangler.toml');
const HEALTH_TIMEOUT_MS = 60000;

function log(message) {
  console.log('[backup-app] ' + message);
}

function runWrangler(args, opts) {
  const cwd = (opts && opts.cwd) || PROJECT_DIR;
  const result = spawnSync('npx', args, { cwd, stdio: 'inherit' });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error('Perintah wrangler gagal (kode ' + result.status + ').');
}

async function waitForHealth(port, timeoutMs) {
  const url = healthUrl(port);
  const deadline = Date.now() + (timeoutMs || HEALTH_TIMEOUT_MS);
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (err) {
      // server belum siap; coba lagi
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  return false;
}

function browserCommand(platform, url) {
  if (platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '', url] };
  if (platform === 'linux') return { cmd: 'xdg-open', args: [url] };
  return { cmd: 'open', args: [url] };
}

async function main() {
  const argv = process.argv.slice(2);

  try {
    assertLocalOnly(argv);
  } catch (err) {
    console.error('[backup-app] ' + err.message);
    process.exitCode = 2;
    return;
  }

  const opts = parseArgs(argv, process.env);

  let dump = '';
  let workDir = '';
  let dir = '';
  try {
    workDir = validateWorkDir(opts.workDir);
    if (opts.reuse) {
      dir = sessionDir(workDir, '', { reuse: opts.reuse });
      dump = join(dir, 'backup.sql');
      if (!existsSync(dump)) throw new Error('Folder --reuse tidak punya backup.sql: ' + dir);
    } else {
      dump = validateDumpPath(opts.dump, process.cwd());
    }
  } catch (err) {
    console.error('[backup-app] ' + err.message);
    process.exitCode = 2;
    return;
  }

  let databaseId = '';
  if (!opts.reuse) {
    try {
      dir = ensureDir(sessionDir(workDir, dump, {}));
      copyDump(dump, dir);
      databaseId = '';
    } catch (err) {
      console.error('[backup-app] gagal menyiapkan folder sesi: ' + err.message);
      process.exitCode = 1;
      return;
    }
  }

  log('rencana:\n' + describePlan(Object.assign({}, opts, { dump }), dir));

  if (!opts.reuse) {
    try {
      const args = buildD1Args({ database: opts.database, workDir: dir, file: join(dir, 'backup.sql') });
      runWrangler([...args, '--config', CONFIG]);
    } catch (err) {
      console.error('[backup-app] impor dump gagal: ' + err.message);
      process.exitCode = 1;
      return;
    }
    log('dump diimpor ke D1 lokal di ' + dir);
  } else {
    log('memakai ulang sesi: ' + dir);
  }

  const devArgs = buildDevArgs({ workDir: dir, port: opts.port, ip: '127.0.0.1', readOnly: opts.readOnly });
  log('$ npx ' + devArgs.join(' '));

  const child = spawn('npx', devArgs, { cwd: PROJECT_DIR, stdio: 'inherit' });
  const shutdown = () => {
    if (!child.killed) child.kill('SIGINT');
  };
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  child.on('exit', (code) => { process.exitCode = typeof code === 'number' ? code : 0; });

  const ready = await waitForHealth(opts.port, HEALTH_TIMEOUT_MS);
  if (!ready) {
    log('server belum menjawab /api/health; buka manual: ' + appUrl(opts.port));
    return;
  }

  log('siap: ' + appUrl(opts.port));
  if (opts.readOnly) {
    log('mode baca-saja aktif: RPC tulis dan unggahan ditolak (HTTP 403).');
  } else {
    log('PERINGATAN: mode izinkan-tulis. Perubahan hanya di salinan lokal, tetapi tetap tidak disarankan.');
  }
  log('data sesi: ' + dir);
  log('tekan Ctrl+C untuk berhenti.');

  if (opts.open) {
    const target = browserCommand(process.platform, appUrl(opts.port));
    spawn(target.cmd, target.args, { stdio: 'ignore', detached: true }).unref();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[backup-app] ' + (err && err.message ? err.message : String(err)));
    process.exitCode = 1;
  });
}

export { browserCommand, waitForHealth };
