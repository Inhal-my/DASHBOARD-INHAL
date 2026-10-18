import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getArg } from './lib/args.mjs';

const ITERATIONS = 100000;
const KEY_BITS = 256;

function escapeSql(value) {
  return String(value || '').replace(/'/g, "''");
}

function toB64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

const database = getArg(process.argv, '--database', 'inhal-poc-staging');
const config = getArg(process.argv, '--config', 'wrangler.staging.toml');
const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');
const apply = process.argv.includes('--apply');
const nama = getArg(process.argv, '--nama', 'Staging Admin');
const password = process.env.STAGING_ADMIN_PASSWORD || '';

if (!password || password.length < 12) {
  console.error('Set STAGING_ADMIN_PASSWORD (minimal 12 karakter) sebelum menjalankan seed.');
  process.exit(1);
}

const hash = await hashPassword(password);
const nameSql = escapeSql(nama);
const sql = [
  `INSERT INTO admin (password, nama) SELECT '${escapeSql(hash)}', '${nameSql}'`,
  `WHERE NOT EXISTS (SELECT 1 FROM admin WHERE nama = '${nameSql}');`,
  `UPDATE admin SET password = '${escapeSql(hash)}' WHERE nama = '${nameSql}';`,
  `UPDATE admin_mfa SET enabled = 0 WHERE admin_id IN (SELECT id FROM admin WHERE nama = '${nameSql}');`,
  ''
].join('\n');

if (!apply) {
  process.stdout.write(sql);
  process.exit(0);
}
if (!remote && !local) {
  console.error('--apply membutuhkan --remote atau --local.');
  process.exit(1);
}

const path = join(tmpdir(), `inhal-staging-seed-${Date.now()}.sql`);
writeFileSync(path, sql);

const args = [
  'wrangler', 'd1', 'execute', database,
  remote ? '--remote' : '--local',
  `--file=${path}`, '--yes', '--config', config
];

console.log(`Seeding admin staging "${nama}" ke ${database}...`);
const result = spawnSync('npx', args, { stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exit(result.status || 1);
console.log('Seed selesai.');
