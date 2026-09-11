import { requireAdmin } from '../session.js';
import { hashPassword, isHashed } from '../password.js';

const STATUS_VALID = ['Menunggu', 'Diterima', 'ACC', 'Ditolak', 'Dibatalkan'];
const MAX_ROWS = 5000;

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function pick(row, keys) {
  for (const k of keys) {
    const v = str(row && row[k]);
    if (v !== '') return v;
  }
  return '';
}

function normalizeRows(rows, fields) {
  const out = [];
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    const mapped = {};
    let filled = false;
    for (const [field, keys] of fields) {
      const v = pick(row, keys);
      mapped[field] = v;
      if (v !== '') filled = true;
    }
    if (filled) out.push(mapped);
  }
  return out;
}

async function replaceAll(db, table, columns, rows) {
  const statements = [db.prepare('DELETE FROM ' + table)];
  for (const row of rows) {
    const placeholders = columns.map((_, i) => '?' + (i + 1)).join(', ');
    statements.push(
      db.prepare('INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES (' + placeholders + ')')
        .bind(...columns.map((c) => (row[c] === undefined ? '' : row[c])))
    );
  }
  await db.batch(statements);
}

function tooMany(rows) {
  if (rows.length > MAX_ROWS) {
    return { success: false, message: 'Terlalu banyak baris (maks ' + MAX_ROWS + ').' };
  }
  return null;
}

async function upsertConfig(db, key, value) {
  await db.prepare(
    'INSERT INTO config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(key, value).run();
}

export async function saveMasterKegiatan(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = normalizeRows(payload && payload.rows, [
    ['kategori', ['Kategori', 'kategori']],
    ['nilai', ['Nilai', 'nilai']]
  ]);
  const guard = tooMany(rows);
  if (guard) return guard;
  await replaceAll(db, 'master_kegiatan', ['kategori', 'nilai'], rows);
  return { success: true, message: 'Master kegiatan diperbarui.' };
}

export async function saveMasterBagian(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = normalizeRows(payload && payload.rows, [
    ['lab', ['Lab', 'lab']],
    ['kegiatan_lab', ['Kegiatan Lab', 'KegiatanLab', 'kegiatanLab', 'kegiatan_lab']],
    ['bagian', ['Bagian', 'bagian']],
    ['email', ['Email', 'email']]
  ]);
  const guard = tooMany(rows);
  if (guard) return guard;
  await replaceAll(db, 'master_bagian', ['lab', 'kegiatan_lab', 'bagian', 'email'], rows);
  return { success: true, message: 'Master bagian diperbarui.' };
}

export async function saveMasterBiaya(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = normalizeRows(payload && payload.rows, [
    ['kegiatan', ['Kegiatan', 'kegiatan']],
    ['biaya', ['Biaya', 'biaya']]
  ]);
  const guard = tooMany(rows);
  if (guard) return guard;
  await replaceAll(db, 'master_biaya', ['kegiatan', 'biaya'], rows);
  return { success: true, message: 'Master biaya diperbarui.' };
}

export async function saveConfig(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = normalizeRows(payload && payload.rows, [
    ['key', ['Key', 'key']],
    ['value', ['Value', 'value']]
  ]);
  const guard = tooMany(rows);
  if (guard) return guard;
  const byKey = new Map();
  for (const row of rows) {
    if (!row.key) continue;
    byKey.set(row.key.toLowerCase(), row);
  }
  const clean = Array.from(byKey.values());
  await replaceAll(db, 'config', ['key', 'value'], clean);
  return { success: true, message: 'Config diperbarui.' };
}

export async function saveBagianStaff(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = normalizeRows(payload && payload.rows, [
    ['email', ['Email', 'email']],
    ['kategori', ['Kategori', 'kategori']],
    ['nama', ['Nama', 'nama']],
    ['pass', ['Pass', 'pass', 'Password', 'password']]
  ]).filter((r) => r.email || r.pass);
  const guard = tooMany(rows);
  if (guard) return guard;
  for (const row of rows) {
    if (row.pass && !isHashed(row.pass)) row.pass = await hashPassword(row.pass);
  }
  await replaceAll(db, 'bagian_staff', ['email', 'kategori', 'nama', 'pass'], rows);
  return { success: true, message: 'Bagian staff diperbarui.' };
}

export async function saveAdminList(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = normalizeRows(payload && payload.rows, [
    ['password', ['Password', 'password', 'Email', 'email']],
    ['nama', ['Nama', 'nama']]
  ]).filter((r) => r.password);
  const guard = tooMany(rows);
  if (guard) return guard;
  for (const row of rows) {
    if (row.password && !isHashed(row.password)) row.password = await hashPassword(row.password);
  }
  await replaceAll(db, 'admin', ['password', 'nama'], rows);
  return { success: true, message: 'Daftar admin diperbarui.' };
}

export async function saveBagianBaSettings(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const raw = payload && payload.statuses ? payload.statuses : [];
  const statuses = [];
  const seen = new Set();
  (Array.isArray(raw) ? raw : [raw]).forEach((s) => {
    const v = str(s);
    if (v && !seen.has(v)) { seen.add(v); statuses.push(v); }
  });
  const invalid = statuses.filter((s) => STATUS_VALID.indexOf(s) === -1);
  if (invalid.length) {
    return { success: false, message: 'Status tidak dikenal: ' + invalid.join(', ') };
  }
  if (!statuses.length) {
    return { success: false, message: 'Pilih minimal satu status peserta untuk Berita Acara.' };
  }
  const finalOnly = payload && payload.finalOnly !== undefined ? !!payload.finalOnly : true;
  await upsertConfig(db, 'BAGIAN_BA_STATUSES', statuses.join(','));
  await upsertConfig(db, 'BAGIAN_BA_FINAL_ONLY', finalOnly ? 'true' : 'false');
  return { success: true, message: 'Pengaturan Berita Acara Bagian diperbarui.' };
}
