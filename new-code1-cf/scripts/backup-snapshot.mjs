import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { buildXlsx } from '../src/xlsxExport.js';

/**
 * Membuat artefak pendamping dari dump D1:
 *   - <label>-snapshot.json.gz : seluruh tabel (kolom besar dikecualikan)
 *   - <label>-database.xlsx    : rekap yang bisa dibuka tanpa aplikasi
 *   - manifest.json            : hash, jumlah baris, ukuran, status ambang
 *
 * Pemakaian:
 *   node scripts/backup-snapshot.mjs <dump.sql> --out=<dir> [--label=YYYYMMDD-HHmm]
 *     [--plan=free|paid] [--database=inhal-poc]
 */

const CORE_TABLES = ['mahasiswa', 'pengajuan', 'master_kegiatan', 'berita_acara', 'berita_acara_admin'];
const SKIP_TABLES = new Set(['_cf_KV', 'd1_migrations', 'sessions', 'auth_throttle']);
const SKIP_XLSX_TABLES = new Set(['uploads']);
const BIG_COLUMN_BYTES = 20000;

const PLAN_LIMITS = {
  free: { maxBytes: 500 * 1024 * 1024, warnBytes: 300 * 1024 * 1024, label: 'Workers Free (500 MB)' },
  paid: { maxBytes: 10 * 1024 * 1024 * 1024, warnBytes: 6 * 1024 * 1024 * 1024, label: 'Workers Paid (10 GB)' }
};

export { PLAN_LIMITS };

/** Status ambang ukuran: `ok`, `warn` (>= 60% batas), atau `over` (>= batas paket). */
export function sizeStatus(totalBytes, limits) {
  const bytes = Number(totalBytes) || 0;
  if (bytes >= limits.maxBytes) return 'over';
  if (bytes >= limits.warnBytes) return 'warn';
  return 'ok';
}

function argOf(argv, name, fallback) {
  const prefix = '--' + name + '=';
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function usage(message) {
  console.error(message);
  console.error('Pemakaian: node scripts/backup-snapshot.mjs <dump.sql> --out=<dir> [--label=YYYYMMDD-HHmm] [--plan=free|paid] [--database=inhal-poc]');
  process.exit(2);
}

function safe(identifier) {
  return '"' + String(identifier).replace(/"/g, '""') + '"';
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function stamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return String(date.getUTCFullYear()) + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) +
    '-' + pad(date.getUTCHours()) + pad(date.getUTCMinutes());
}

export { stamp };

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => String(r.name))
    .filter((name) => !SKIP_TABLES.has(name));
}

function tableColumns(db, table) {
  return db.prepare('PRAGMA table_info(' + safe(table) + ')')
    .all()
    .map((c) => String(c.name));
}

function maxColumnBytes(db, table, column) {
  try {
    const row = db.prepare(
      'SELECT COALESCE(MAX(LENGTH(' + safe(column) + ')), 0) AS n FROM ' + safe(table)
    ).get();
    return Number(row && row.n) || 0;
  } catch (err) {
    return 0;
  }
}

function tableBytes(db, table, columns) {
  if (!columns.length) return 0;
  try {
    const expr = columns.map((c) => 'COALESCE(LENGTH(' + safe(c) + '), 0)').join(' + ');
    const row = db.prepare('SELECT COALESCE(SUM(' + expr + '), 0) AS n FROM ' + safe(table)).get();
    return Number(row && row.n) || 0;
  } catch (err) {
    return 0;
  }
}

function readUploads(db) {
  const exists = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'uploads'").get();
  if (!exists || Number(exists.n) === 0) return { present: false, rows: 0, contentBytes: 0 };
  const cols = tableColumns(db, 'uploads');
  const rows = Number(db.prepare('SELECT COUNT(*) AS n FROM uploads').get().n) || 0;
  const bytes = cols.indexOf('content') === -1
    ? 0
    : Number(db.prepare('SELECT COALESCE(SUM(LENGTH(content)), 0) AS n FROM uploads').get().n) || 0;
  return { present: true, rows: rows, contentBytes: bytes };
}

function main() {
  const argv = process.argv.slice(2);
  const dumpFile = argv.find((a) => !a.startsWith('--'));
  if (!dumpFile) usage('Berkas dump wajib disebutkan.');
  const outDir = argOf(argv, 'out', '.');
  const plan = argOf(argv, 'plan', 'free');
  const database = argOf(argv, 'database', 'inhal-poc');
  const limits = PLAN_LIMITS[plan];
  if (!limits) usage('--plan harus free atau paid.');

  const dumpBytes = readFileSync(dumpFile);
  let db;
  try {
    db = new DatabaseSync(':memory:');
    db.exec(dumpBytes.toString('utf8'));
  } catch (err) {
    console.error(JSON.stringify({
      ok: false,
      error: 'Gagal mengimpor dump ke sqlite lokal: ' + String((err && err.message) || err)
    }, null, 2));
    process.exit(1);
  }

  const integrityRows = db.prepare('PRAGMA integrity_check').all();
  const integrity = integrityRows.length ? String(integrityRows[0].integrity_check || '') : 'gagal';

  const label = argOf(argv, 'label', stamp(new Date()));
  mkdirSync(outDir, { recursive: true });

  const counts = {};
  const byTableBytes = {};
  const excludedColumns = {};
  const snapshotTables = [];
  const xlsxTables = [];

  for (const table of tableNames(db)) {
    const columns = tableColumns(db, table);
    const rows = db.prepare('SELECT * FROM ' + safe(table)).all();
    counts[table] = rows.length;
    byTableBytes[table] = tableBytes(db, table, columns);

    const bigColumns = columns.filter((c) => maxColumnBytes(db, table, c) > BIG_COLUMN_BYTES);
    if (bigColumns.length) excludedColumns[table] = bigColumns;

    const kept = columns.filter((c) => bigColumns.indexOf(c) === -1);
    const projected = rows.map((row) => {
      const out = {};
      for (const column of kept) out[column] = row[column] == null ? null : row[column];
      return out;
    });

    snapshotTables.push({ name: table, columns: kept, rows: projected });
    if (!SKIP_XLSX_TABLES.has(table) && kept.length) {
      xlsxTables.push({ name: table, columns: kept, rows: projected });
    }
  }

  const totalBytes = Object.keys(byTableBytes).reduce((sum, key) => sum + byTableBytes[key], 0);
  const missing = CORE_TABLES.filter((t) => !(t in counts));

  const snapshotPayload = {
    schemaVersion: 1,
    database: database,
    label: label,
    generatedAt: new Date().toISOString(),
    sourceDump: basename(dumpFile),
    counts: counts,
    excludedColumns: excludedColumns,
    tables: snapshotTables
  };
  const snapshotBuffer = gzipSync(Buffer.from(JSON.stringify(snapshotPayload), 'utf8'), { level: 9 });
  const snapshotName = label + '-snapshot.json.gz';
  writeFileSync(join(outDir, snapshotName), snapshotBuffer);

  const xlsxBuffer = Buffer.from(buildXlsx(xlsxTables));
  const xlsxName = label + '-database.xlsx';
  writeFileSync(join(outDir, xlsxName), xlsxBuffer);

  const manifest = {
    schemaVersion: 1,
    database: database,
    label: label,
    generatedAt: new Date().toISOString(),
    plan: { name: plan, maxBytes: limits.maxBytes, warnBytes: limits.warnBytes, label: limits.label },
    source: { file: basename(dumpFile), bytes: dumpBytes.length, sha256: sha256(dumpBytes) },
    artifacts: [
      { file: snapshotName, bytes: snapshotBuffer.length, sha256: sha256(snapshotBuffer) },
      { file: xlsxName, bytes: xlsxBuffer.length, sha256: sha256(xlsxBuffer) }
    ],
    verification: {
      integrity: integrity,
      coreTables: CORE_TABLES,
      missingCoreTables: missing,
      ok: integrity === 'ok' && missing.length === 0
    },
    counts: counts,
    totalRows: Object.keys(counts).reduce((sum, key) => sum + counts[key], 0),
    uploads: readUploads(db),
    excludedColumns: excludedColumns,
    size: {
      estimatedBytes: totalBytes,
      estimatedHuman: (totalBytes / (1024 * 1024)).toFixed(2) + ' MB',
      dumpBytes: dumpBytes.length,
      byTable: byTableBytes,
      warnBytes: limits.warnBytes,
      maxBytes: limits.maxBytes,
      status: sizeStatus(totalBytes, limits)
    }
  };

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(JSON.stringify({
    ok: manifest.verification.ok,
    label: label,
    outDir: outDir,
    integrity: integrity,
    missingCoreTables: missing,
    totalRows: manifest.totalRows,
    counts: counts,
    uploads: manifest.uploads,
    size: { estimated: manifest.size.estimatedHuman, status: manifest.size.status, plan: limits.label },
    artifacts: manifest.artifacts
  }, null, 2));

  process.exitCode = manifest.verification.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();