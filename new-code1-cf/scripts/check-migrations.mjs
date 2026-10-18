import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  listMigrations,
  parseNameStatus,
  findForbiddenChanges,
  findAddedMigrations
} from './lib/migrations.mjs';
import { getArg } from './lib/args.mjs';

const migrationsDir = join(process.cwd(), 'migrations');
const base = getArg(process.argv, '--base', '');

try {
  const files = listMigrations(migrationsDir);
  if (files.length === 0) throw new Error('Tidak ada file migrasi.');
  console.log(`Migrasi: ${files.length} file, nama dan urutan valid.`);

  if (base && !/^0+$/.test(base)) {
    const output = execFileSync(
      'git',
      ['diff', '--name-status', base, '--', 'migrations'],
      { encoding: 'utf8' }
    );
    const entries = parseNameStatus(output);
    const forbidden = findForbiddenChanges(entries);
    if (forbidden.length) {
      throw new Error(
        'Migrasi lama tidak boleh diubah, dihapus, atau di-rename:\n' +
          forbidden.map((entry) => `- ${entry.status} ${entry.path}`).join('\n') +
          '\nTambahkan file migrasi baru dengan tanggal hari ini.'
      );
    }

    const addedNames = new Set(
      findAddedMigrations(entries).map((entry) => entry.path.split('/').pop())
    );
    if (addedNames.size) {
      const baseDates = files
        .filter((file) => !addedNames.has(file.name))
        .map((file) => file.name.slice(0, 10));
      const latestDate = baseDates.sort().at(-1) || '';
      for (const name of addedNames) {
        if (name.slice(0, 10) <= latestDate) {
          throw new Error(
            `Migrasi baru ${name} harus bertanggal setelah migrasi terakhir (${latestDate}).`
          );
        }
      }
    }

    console.log(`Tidak ada migrasi lama yang berubah terhadap ${base}.`);
  }
} catch (error) {
  console.error(`Pemeriksaan migrasi gagal: ${error.message}`);
  process.exit(1);
}
