import { requireAdmin, AUTH_ERROR } from './session.js';
import { buildXlsx } from './xlsxExport.js';
import { TABLE_COLUMNS } from './read/columns.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const SENSITIVE_COLUMNS = new Set(['password', 'pass', 'token', 'content']);

export const SYSTEM_TABLES = new Set([
  'admin',
  'bagian_staff',
  'sessions',
  'auth_throttle',
  'uploads',
  'audit_log',
  'log_data'
]);

export const NUMERIC_COLUMNS = new Set([
  'master_biaya.biaya',
  'check_data.biaya',
  'berita_acara.jumlah_peserta',
  'berita_acara_admin.jumlah_peserta'
]);

export function jakartaDateStamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

export function exportFileName(now = new Date()) {
  return 'inhal-database-' + jakartaDateStamp(now) + '.xlsx';
}

export function isExportableTable(name) {
  const n = String(name);
  return n !== '' && !n.startsWith('sqlite_') && !n.startsWith('_cf_');
}

export function tableGroup(name) {
  return SYSTEM_TABLES.has(String(name)) ? 'system' : 'master';
}

export async function listUserTables(db) {
  const { results } = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' ORDER BY name"
  ).all();
  return (results || [])
    .map((r) => String(r.name))
    .filter(isExportableTable);
}

async function tableColumnKeys(db, name, rows) {
  if (rows.length) return Object.keys(rows[0]);
  const info = await db.prepare('PRAGMA table_info("' + name.replace(/"/g, '""') + '")').all();
  return (info.results || []).map((c) => c.name);
}

function buildColumns(tableName, keys) {
  const labels = TABLE_COLUMNS[tableName] || {};
  return keys.map((key) => ({
    key,
    label: labels[key] || key,
    numeric: NUMERIC_COLUMNS.has(tableName + '.' + key)
  }));
}

export async function readAllTables(db, scope = 'master') {
  const includeSystem = scope === 'all';
  const names = await listUserTables(db);
  const tables = [];
  for (const name of names) {
    if (!includeSystem && tableGroup(name) === 'system') continue;
    const { results } = await db.prepare('SELECT * FROM "' + name.replace(/"/g, '""') + '"').all();
    const rows = results || [];
    const keys = (await tableColumnKeys(db, name, rows))
      .filter((k) => !SENSITIVE_COLUMNS.has(String(k).toLowerCase()));
    if (!keys.length) continue;
    const columns = buildColumns(name, keys);
    const cleanRows = rows.map((row) => {
      const out = {};
      for (const key of keys) out[key] = row[key];
      return out;
    });
    tables.push({ name, columns, rows: cleanRows });
  }
  return tables;
}

export async function exportDatabase(db, token, scope = 'master', now = new Date()) {
  try {
    await requireAdmin(db, token);
  } catch (e) {
    const msg = e && e.message ? e.message : AUTH_ERROR;
    return { status: 401, json: { success: false, message: msg } };
  }
  try {
    const tables = await readAllTables(db, scope === 'all' ? 'all' : 'master');
    const body = buildXlsx(tables);
    const filename = exportFileName(now);
    return {
      status: 200,
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': 'attachment; filename="' + filename + '"'
      },
      body
    };
  } catch (e) {
    return { status: 500, json: { success: false, message: 'Gagal mengunduh database.' } };
  }
}
