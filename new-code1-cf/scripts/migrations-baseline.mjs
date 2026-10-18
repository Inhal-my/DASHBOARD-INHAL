import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { listMigrations, buildBaselineSql } from './lib/migrations.mjs';
import { getArg } from './lib/args.mjs';

const args = process.argv;
const migrationsDir = join(process.cwd(), 'migrations');
const output = getArg(args, '--output', '');
const apply = args.includes('--apply');
const database = getArg(args, '--database', '');
const remote = args.includes('--remote');
const local = args.includes('--local');
const config = getArg(args, '--config', '');

const files = listMigrations(migrationsDir);
const sql = buildBaselineSql(files.map((file) => file.name));

if (!apply) {
  if (output) {
    writeFileSync(output, sql);
    console.log(`Baseline ditulis ke ${output} (${files.length} migrasi).`);
  } else {
    process.stdout.write(sql);
  }
  process.exit(0);
}

if (!database) {
  console.error('--apply membutuhkan --database <nama-d1>.');
  process.exit(1);
}
if (!remote && !local) {
  console.error('--apply membutuhkan --remote atau --local.');
  process.exit(1);
}

const path = join(tmpdir(), `inhal-migrations-baseline-${Date.now()}.sql`);
writeFileSync(path, sql);

const wranglerArgs = ['wrangler', 'd1', 'execute', database, remote ? '--remote' : '--local', `--file=${path}`, '--yes'];
if (config) wranglerArgs.push('--config', config);

console.log(`Menerapkan baseline ke ${database} (${files.length} migrasi)...`);
const result = spawnSync('npx', wranglerArgs, { stdio: 'inherit', env: process.env });
if (result.status !== 0) {
  console.error('Baseline gagal. Periksa output wrangler di atas.');
  process.exit(result.status || 1);
}
console.log('Baseline selesai.');
