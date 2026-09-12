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

export async function saveMahasiswa(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const row = (payload && payload.row) || {};
  const npm = str(row.npm !== undefined ? row.npm : row.NPM);
  if (!npm) return { success: false, message: 'NPM wajib diisi.' };
  const mode = str(row.mode) === 'update' ? 'update' : 'insert';
  const nama = str(row.namaLengkap !== undefined ? row.namaLengkap : row['Nama Lengkap']);
  const email = str(row.email !== undefined ? row.email : row.Email);
  const blok = str(row.blok !== undefined ? row.blok : row.Blok);
  const keterangan = str(row.keterangan !== undefined ? row.keterangan : row.Keterangan);
  const existing = await db.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind(npm).first();
  if (mode === 'insert') {
    if (existing) return { success: false, message: 'NPM ' + npm + ' sudah ada.' };
    await db.prepare('INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(npm, nama, email, blok, keterangan).run();
    return { success: true, message: 'Mahasiswa ditambahkan.' };
  }
  if (!existing) return { success: false, message: 'NPM ' + npm + ' tidak ditemukan.' };
  await db.prepare('UPDATE mahasiswa SET nama_lengkap = ?2, email = ?3, blok = ?4, keterangan = ?5 WHERE npm = ?1')
    .bind(npm, nama, email, blok, keterangan).run();
  return { success: true, message: 'Mahasiswa diperbarui.' };
}

export async function deleteMahasiswa(db, npm, ctx) {
  await requireAdmin(db, ctx.token);
  const key = str(npm);
  if (!key) return { success: false, message: 'NPM wajib diisi.' };
  const existing = await db.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind(key).first();
  if (!existing) return { success: false, message: 'NPM ' + key + ' tidak ditemukan.' };
  await db.prepare('DELETE FROM mahasiswa WHERE npm = ?1').bind(key).run();
  return { success: true, message: 'Mahasiswa dihapus.' };
}

export async function importMahasiswaCsv(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const list = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const guard = tooMany(list);
  if (guard) return guard;
  const parsed = [];
  const seen = new Set();
  let skipped = 0;
  for (const raw of list) {
    const npm = str(raw && (raw.npm !== undefined ? raw.npm : raw.NPM));
    if (!npm) { skipped++; continue; }
    if (seen.has(npm)) return { success: false, message: 'NPM duplikat di file: ' + npm };
    seen.add(npm);
    const nama = str(raw && (raw.namaLengkap !== undefined ? raw.namaLengkap : raw['Nama Lengkap']));
    parsed.push({ npm: npm, nama: nama });
  }
  if (!parsed.length) return { success: false, message: 'Tidak ada baris valid pada CSV.' };
  const existingRows = (await db.prepare('SELECT npm FROM mahasiswa').all()).results || [];
  const existing = new Set(existingRows.map((r) => String(r.npm)));
  const statements = [];
  let inserted = 0;
  let updated = 0;
  for (const row of parsed) {
    if (existing.has(row.npm)) {
      statements.push(db.prepare('UPDATE mahasiswa SET nama_lengkap = ?2 WHERE npm = ?1').bind(row.npm, row.nama));
      updated++;
    } else {
      statements.push(db.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES (?1, ?2, '', '', '')").bind(row.npm, row.nama));
      inserted++;
    }
  }
  await db.batch(statements);
  return {
    success: true,
    message: 'Impor selesai: ' + inserted + ' baru, ' + updated + ' diperbarui.',
    inserted: inserted,
    updated: updated,
    skipped: skipped
  };
}

const MASTER_TABLES = {
  master_kegiatan: {
    cols: [['kategori', ['Kategori', 'kategori']], ['nilai', ['Nilai', 'nilai']]]
  },
  master_bagian: {
    cols: [
      ['lab', ['Lab', 'lab']],
      ['kegiatan_lab', ['Kegiatan Lab', 'KegiatanLab', 'kegiatanLab', 'kegiatan_lab']],
      ['bagian', ['Bagian', 'bagian']],
      ['email', ['Email', 'email']]
    ]
  },
  master_biaya: {
    cols: [['kegiatan', ['Kegiatan', 'kegiatan']], ['biaya', ['Biaya', 'biaya']]]
  },
  config: {
    cols: [['key', ['Key', 'key']], ['value', ['Value', 'value']]]
  },
  bagian_staff: {
    cols: [
      ['email', ['Email', 'email']], ['kategori', ['Kategori', 'kategori']],
      ['nama', ['Nama', 'nama']], ['pass', ['Pass', 'pass', 'Password', 'password']]
    ],
    passwordCol: 'pass',
    uniqueCol: 'email'
  },
  admin: {
    cols: [['password', ['Password', 'password', 'Email', 'email']], ['nama', ['Nama', 'nama']]],
    passwordCol: 'password'
  }
};

async function rejectDuplicate(db, table, spec, mapped, id) {
  if (!spec.uniqueCol) return null;
  const value = mapped[spec.uniqueCol];
  if (!value) return null;
  const found = await db.prepare('SELECT id FROM ' + table + ' WHERE lower(' + spec.uniqueCol + ') = lower(?1)').bind(value).first();
  if (found && Number(found.id) !== Number(id)) {
    return { success: false, message: 'Nilai ' + value + ' sudah ada.' };
  }
  return null;
}

export async function saveMasterRow(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const table = str(payload && payload.table);
  const spec = MASTER_TABLES[table];
  if (!spec) return { success: false, message: 'Tabel tidak dikenal.' };
  const raw = (payload && payload.row) || {};
  const mapped = {};
  let filled = false;
  for (const [field, keys] of spec.cols) {
    const value = pick(raw, keys);
    mapped[field] = value;
    if (value !== '') filled = true;
  }
  if (!filled) return { success: false, message: 'Baris kosong.' };
  const id = Number(raw.id) || 0;
  if (spec.passwordCol) {
    const pw = mapped[spec.passwordCol];
    if (pw && !isHashed(pw)) mapped[spec.passwordCol] = await hashPassword(pw);
  }
  if (table === 'config') {
    const key = mapped.key;
    if (!key) return { success: false, message: 'Key wajib diisi.' };
    const mode = str(raw.mode) === 'update' ? 'update' : 'insert';
    const found = await db.prepare('SELECT key FROM config WHERE lower(key) = lower(?1)').bind(key).first();
    if (mode === 'update') {
      if (!found) return { success: false, message: 'Config tidak ditemukan.' };
      await db.prepare('UPDATE config SET value = ?2 WHERE lower(key) = lower(?1)').bind(key, mapped.value).run();
      return { success: true, message: 'Config diperbarui.' };
    }
    if (found) return { success: false, message: 'Key ' + key + ' sudah ada.' };
    await db.prepare('INSERT INTO config (key, value) VALUES (?1, ?2)').bind(key, mapped.value).run();
    return { success: true, message: 'Config ditambahkan.' };
  }
  const dupRow = await rejectDuplicate(db, table, spec, mapped, id);
  if (dupRow) return dupRow;
  if (id) {
    const exists = await db.prepare('SELECT id FROM ' + table + ' WHERE id = ?1').bind(id).first();
    if (!exists) return { success: false, message: 'Baris tidak ditemukan.' };
    const fields = spec.cols
      .map(([field]) => field)
      .filter((field) => !(spec.passwordCol === field && mapped[field] === ''));
    const sets = fields.map((field, i) => field + ' = ?' + (i + 2)).join(', ');
    const values = fields.map((field) => mapped[field]);
    await db.prepare('UPDATE ' + table + ' SET ' + sets + ' WHERE id = ?1').bind(id, ...values).run();
    return { success: true, message: 'Baris diperbarui.' };
  }
  const cols = spec.cols.map(([field]) => field);
  const values = cols.map((field) => mapped[field]);
  const placeholders = cols.map((_, i) => '?' + (i + 1)).join(', ');
  await db.prepare('INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + placeholders + ')').bind(...values).run();
  return { success: true, message: 'Baris ditambahkan.' };
}

export async function deleteMasterRow(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const table = str(payload && payload.table);
  if (table === 'config') return { success: false, message: 'Config tidak boleh dihapus.' };
  const spec = MASTER_TABLES[table];
  if (!spec) return { success: false, message: 'Tabel tidak dikenal.' };
  const id = Number(payload && payload.id) || 0;
  if (!id) return { success: false, message: 'ID tidak valid.' };
  const exists = await db.prepare('SELECT id FROM ' + table + ' WHERE id = ?1').bind(id).first();
  if (!exists) return { success: false, message: 'Baris tidak ditemukan.' };
  await db.prepare('DELETE FROM ' + table + ' WHERE id = ?1').bind(id).run();
  return { success: true, message: 'Baris dihapus.' };
}
