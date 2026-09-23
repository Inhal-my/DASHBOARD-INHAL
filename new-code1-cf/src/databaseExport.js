import { requireAdmin, AUTH_ERROR } from './session.js';
import { buildXlsx } from './xlsxExport.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

export async function listUserTables(db) {
  const { results } = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();
  return (results || []).map((r) => String(r.name));
}

export async function readAllTables(db) {
  const names = await listUserTables(db);
  const tables = [];
  for (const name of names) {
    const { results } = await db.prepare('SELECT * FROM "' + name.replace(/"/g, '""') + '"').all();
    const rows = results || [];
    let columns = [];
    if (rows.length) {
      columns = Object.keys(rows[0]);
    } else {
      const info = await db.prepare('PRAGMA table_info("' + name.replace(/"/g, '""') + '")').all();
      columns = (info.results || []).map((c) => c.name);
    }
    tables.push({ name, columns, rows });
  }
  return tables;
}

export async function exportDatabase(db, token, now = new Date()) {
  try {
    await requireAdmin(db, token);
  } catch (e) {
    const msg = e && e.message ? e.message : AUTH_ERROR;
    return { status: 401, json: { success: false, message: msg } };
  }
  try {
    const tables = await readAllTables(db);
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
