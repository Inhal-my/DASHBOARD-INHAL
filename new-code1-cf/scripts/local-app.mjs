import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Peluncur aplikasi INHAL untuk lokal (`npm run app:local`).
 *
 * Menjalankan Worker asli (kode yang sama dengan produksi) di atas D1 lokal,
 * dengan data dari dump cadangan. Tujuannya: tampilan 100% sama tanpa
 * menyentuh Cloudflare.
 *
 * Aturan keamanan: selalu `--local`. Skrip menolak argumen `--remote` agar tidak
 * pernah menyentuh database produksi.
 */

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(here, '..');
const DEFAULT_PORT = 8787;
const DEFAULT_DATABASE = 'inhal-poc';
const HEALTH_TIMEOUT_MS = 30000;

export function parseArgs(argv) {
  const list = Array.isArray(argv) ? argv : [];
  const argOf = (name, fallback) => {
    const prefix = '--' + name + '=';
    const found = list.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
  };
  const portRaw = Number(argOf('port', DEFAULT_PORT));
  const port = Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? portRaw : DEFAULT_PORT;
  return {
    dump: argOf('dump', ''),
    port: port,
    database: argOf('database', DEFAULT_DATABASE),
    persistTo: argOf('persist-to', join(projectDir, 'local-data')),
    reset: list.includes('--reset'),
    open: !list.includes('--no-open'),
    importDump: !list.includes('--no-import')
  };
}

/** Menolak opsi yang bisa menyentuh database remote. */
export function assertLocalOnly(argv) {
  const list = (Array.isArray(argv) ? argv : []).map((a) => String(a));
  const forbidden = list.filter((a) => a === '--remote' || a.startsWith('--remote='));
  if (forbidden.length) {
    throw new Error('Peluncur lokal menolak opsi --remote. Gunakan mode lokal (default skrip ini).');
  }
  return true;
}

export function buildD1Args({ database, persistTo, file }) {
  return [
    'wrangler', 'd1', 'execute', String(database || DEFAULT_DATABASE),
    '--local',
    '--persist-to', String(persistTo),
    '--file', String(file)
  ];
}

export function buildDevArgs({ persistTo, port }) {
  return [
    'wrangler', 'dev',
    '--local',
    '--persist-to', String(persistTo),
    '--port', String(Number(port) || DEFAULT_PORT)
  ];
}

/** Berkas .sql terbaru di folder backup (atau '' bila belum ada). */
export function pickLatestDump(dir) {
  if (!dir || !existsSync(dir)) return '';
  const files = readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .map((name) => ({ name, path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? files[0].path : '';
}

export function healthUrl(port) {
  return 'http://127.0.0.1:' + (Number(port) || DEFAULT_PORT) + '/api/health';
}

function log(message) {
  console.log('[app:local] ' + message);
}

function runWrangler(args) {
  log('$ npx ' + args.join(' '));
  const result = spawnSync('npx', args, { cwd: projectDir, stdio: 'inherit' });
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

async function main() {
  const argv = process.argv.slice(2);
  try {
    assertLocalOnly(argv);
  } catch (err) {
    console.error('[app:local] ' + err.message);
    process.exitCode = 2;
    return;
  }

  const opts = parseArgs(argv);
  const backupsDir = join(opts.persistTo, 'backups');
  const marker = join(opts.persistTo, '.initialized');

  if (opts.reset && existsSync(opts.persistTo)) {
    log('menghapus ' + opts.persistTo);
    spawnSync('rm', ['-rf', opts.persistTo]);
  }
  mkdirSync(backupsDir, { recursive: true });

  const dump = opts.dump || pickLatestDump(backupsDir);
  const willImport = opts.importDump && !!dump && existsSync(dump);

  // Dump `wrangler d1 export` sudah memuat skema, jadi bootstrap schema.sql hanya
  // dijalankan saat TIDAK mengimpor dump (kalau tidak, "table ... already exists").
  if (!existsSync(marker)) {
    if (willImport) {
      log('dump sudah berisi skema; melewati bootstrap schema.sql');
    } else {
      log('menyiapkan D1 lokal dari schema.sql');
      runWrangler(buildD1Args({ database: opts.database, persistTo: opts.persistTo, file: join(projectDir, 'schema.sql') }));
    }
    writeFileSync(marker, new Date().toISOString() + '\n');
  }

  if (willImport) {
    log('mengimpor dump: ' + dump);
    runWrangler(buildD1Args({ database: opts.database, persistTo: opts.persistTo, file: dump }));
    writeFileSync(join(opts.persistTo, '.active-backup'), dump + '\n');
  } else {
    log('tanpa impor dump (taruh berkas .sql di ' + backupsDir + ' atau pakai --dump=<file>).');
  }

  const devArgs = buildDevArgs({ persistTo: opts.persistTo, port: opts.port });
  log('$ npx ' + devArgs.join(' '));
  const child = spawn('npx', devArgs, { cwd: projectDir, stdio: 'inherit' });

  const shutdown = () => {
    if (!child.killed) child.kill('SIGINT');
  };
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  child.on('exit', (code) => { process.exitCode = typeof code === 'number' ? code : 0; });

  if (opts.open) {
    const ready = await waitForHealth(opts.port, HEALTH_TIMEOUT_MS);
    const url = 'http://127.0.0.1:' + opts.port;
    if (!ready) {
      log('server belum menjawab /api/health; buka manual: ' + url);
      return;
    }
    log('siap: ' + url);
    const target = browserCommand(process.platform, url);
    spawn(target.cmd, target.args, { stdio: 'ignore', detached: true }).unref();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[app:local] ' + (err && err.message ? err.message : String(err)));
    process.exitCode = 1;
  });
}


export function browserCommand(platform, url) {
  if (platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '', url] };
  if (platform === 'linux') return { cmd: 'xdg-open', args: [url] };
  return { cmd: 'open', args: [url] };
}
