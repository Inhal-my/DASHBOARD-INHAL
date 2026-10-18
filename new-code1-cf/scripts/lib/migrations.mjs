import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MIGRATION_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.sql$/;

export function isValidMigrationName(name) {
  return MIGRATION_PATTERN.test(String(name || ''));
}

export function listMigrations(dir) {
  const names = readdirSync(dir)
    .filter((name) => {
      try {
        return statSync(join(dir, name)).isFile() && name.endsWith('.sql');
      } catch {
        return false;
      }
    })
    .sort();

  for (const name of names) {
    if (!isValidMigrationName(name)) {
      throw new Error(
        `Nama migrasi tidak valid: ${name}. Gunakan format YYYY-MM-DD-nama-file.sql (huruf kecil, tanda hubung).`
      );
    }
  }

  return names.map((name) => ({
    name,
    path: join(dir, name),
    sql: readFileSync(join(dir, name), 'utf8')
  }));
}

export function parseNameStatus(output) {
  const entries = [];
  for (const line of String(output || '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0].trim();
    if (!status) continue;
    if (status.startsWith('R') && parts.length >= 3) {
      entries.push({ status, path: parts[1], newPath: parts[2] });
    } else if (parts.length >= 2) {
      entries.push({ status, path: parts[1] });
    }
  }
  return entries;
}

export function findForbiddenChanges(entries) {
  return (entries || []).filter((entry) => {
    const status = String(entry.status || '');
    const path = String(entry.path || '').replace(/\\/g, '/');
    const touchesMigrations = path.startsWith('migrations/') || path.includes('/migrations/');
    return touchesMigrations && /^[MDR]/.test(status);
  });
}

export function findAddedMigrations(entries) {
  return (entries || []).filter((entry) => {
    const status = String(entry.status || '');
    const path = String(entry.path || '').replace(/\\/g, '/');
    const touchesMigrations = path.startsWith('migrations/') || path.includes('/migrations/');
    return touchesMigrations && status.startsWith('A');
  });
}

function escapeSql(value) {
  return String(value || '').replace(/'/g, "''");
}

export function buildBaselineSql(names) {
  const lines = [
    '-- Baseline d1_migrations untuk database yang sudah memiliki skema terkini.',
    '-- Hanya membuat tabel pelacak dan mendaftarkan migrasi yang sudah diterapkan.',
    'CREATE TABLE IF NOT EXISTS "d1_migrations"(',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  name TEXT UNIQUE,',
    '  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL',
    ');'
  ];
  for (const name of names || []) {
    lines.push(`INSERT OR IGNORE INTO "d1_migrations" (name) VALUES ('${escapeSql(name)}');`);
  }
  return lines.join('\n') + '\n';
}
