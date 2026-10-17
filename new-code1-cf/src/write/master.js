import { requireAdmin } from '../session.js';
import { hashPassword, isHashed } from '../password.js';
import { kegiatanKey } from '../read/common.js';
import { writeAuditLog } from '../audit.js';
import { BLOK_REF_TABLES, KEGIATAN_KEY_TABLES } from '../masterRefs.js';

const STATUS_VALID = ['Menunggu', 'ACC', 'Ditolak', 'Dibatalkan'];
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

function guardRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: 'Tidak ada baris valid untuk disimpan.' };
  }
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
  await requireAdmin(db, ctx.token, ctx.session);
  const rows = normalizeRows(payload && payload.rows, [
    ['kategori', ['Kategori', 'kategori']],
    ['nilai', ['Nilai', 'nilai']]
  ]);
  const guard = guardRows(rows);
  if (guard) return guard;
  const nextBlok = new Set(rows.filter((r) => String(r.kategori || '').trim().toLowerCase() === 'blok').map((r) => masterValue(r.nilai).toLowerCase()));
  const { results: currentBlok } = await db.prepare("SELECT nilai FROM master_kegiatan WHERE lower(trim(kategori)) = 'blok'").all();
  for (const row of currentBlok || []) {
    const oldValue = masterValue(row.nilai);
    if (nextBlok.has(oldValue.toLowerCase())) continue;
    const usage = await blokUsage(db, oldValue);
    if (usage.total > 0) {
      return {
        success: false, code: 'RENAME_REQUIRED',
        message: 'Blok "' + oldValue + '" masih dipakai. Ganti nama lewat tombol Ganti nama agar semua data ikut diperbarui.'
      };
    }
  }
  await replaceAll(db, 'master_kegiatan', ['kategori', 'nilai'], rows);
  return { success: true, message: 'Master kegiatan diperbarui.' };
}

export async function saveMasterBagian(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const rows = normalizeRows(payload && payload.rows, [
    ['lab', ['Lab', 'lab']],
    ['kegiatan_lab', ['Kegiatan Lab', 'KegiatanLab', 'kegiatanLab', 'kegiatan_lab']],
    ['bagian', ['Bagian', 'bagian']],
    ['email', ['Email', 'email']]
  ]);
  const guard = guardRows(rows);
  if (guard) return guard;
  await replaceAll(db, 'master_bagian', ['lab', 'kegiatan_lab', 'bagian', 'email'], rows);
  return { success: true, message: 'Master bagian diperbarui.' };
}

export async function saveMasterBiaya(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const rows = normalizeRows(payload && payload.rows, [
    ['kegiatan', ['Kegiatan', 'kegiatan']],
    ['biaya', ['Biaya', 'biaya']]
  ]);
  const guard = guardRows(rows);
  if (guard) return guard;
  await replaceAll(db, 'master_biaya', ['kegiatan', 'biaya'], rows);
  return { success: true, message: 'Master biaya diperbarui.' };
}

export async function saveConfig(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const rows = normalizeRows(payload && payload.rows, [
    ['key', ['Key', 'key']],
    ['value', ['Value', 'value']]
  ]);
  const byKey = new Map();
  for (const row of rows) {
    if (!row.key) continue;
    byKey.set(row.key.toLowerCase(), row);
  }
  const clean = Array.from(byKey.values());
  const guard = guardRows(clean);
  if (guard) return guard;
  await replaceAll(db, 'config', ['key', 'value'], clean);
  return { success: true, message: 'Config diperbarui.' };
}

export async function saveBagianStaff(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const rows = normalizeRows(payload && payload.rows, [
    ['email', ['Email', 'email']],
    ['kategori', ['Kategori', 'kategori']],
    ['nama', ['Nama', 'nama']],
    ['pass', ['Pass', 'pass', 'Password', 'password']]
  ]).filter((r) => r.email || r.pass);
  const guard = guardRows(rows);
  if (guard) return guard;
  for (const row of rows) {
    if (row.pass && !isHashed(row.pass)) row.pass = await hashPassword(row.pass);
  }
  await replaceAll(db, 'bagian_staff', ['email', 'kategori', 'nama', 'pass'], rows);
  return { success: true, message: 'Bagian staff diperbarui.' };
}

export async function saveAdminList(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const rows = normalizeRows(payload && payload.rows, [
    ['password', ['Password', 'password', 'Email', 'email']],
    ['nama', ['Nama', 'nama']]
  ]).filter((r) => r.password);
  const guard = guardRows(rows);
  if (guard) return guard;
  for (const row of rows) {
    if (row.password && !isHashed(row.password)) row.password = await hashPassword(row.password);
  }
  await replaceAll(db, 'admin', ['password', 'nama'], rows);
  return { success: true, message: 'Daftar admin diperbarui.' };
}

export async function saveBagianBaSettings(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
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
  await requireAdmin(db, ctx.token, ctx.session);
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
  await requireAdmin(db, ctx.token, ctx.session);
  const key = str(npm);
  if (!key) return { success: false, message: 'NPM wajib diisi.' };
  const existing = await db.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind(key).first();
  if (!existing) return { success: false, message: 'NPM ' + key + ' tidak ditemukan.' };
  await db.prepare('DELETE FROM mahasiswa WHERE npm = ?1').bind(key).run();
  return { success: true, message: 'Mahasiswa dihapus.' };
}

export async function importMahasiswaCsv(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const list = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const guard = guardRows(list);
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
    cols: [['password', ['Password', 'password']], ['nama', ['Nama', 'nama']]],
    passwordCol: 'password'
  }
};

const MAX_RENAME_ROWS = 5000;

function masterValue(v) {
  return str(v).replace(/\s+/g, ' ');
}

async function blokUsage(db, value) {
  const out = {};
  const counts = await Promise.all(BLOK_REF_TABLES.map(async (table) => {
    const row = await db.prepare(
      'SELECT COUNT(*) AS n FROM ' + table + ' WHERE lower(trim(blok)) = lower(trim(?1))'
    ).bind(value).first();
    return Number(row && row.n) || 0;
  }));
  BLOK_REF_TABLES.forEach((table, i) => { out[table] = counts[i]; });
  out.total = counts.reduce((sum, n) => sum + n, 0);
  return out;
}

async function findMasterConflict(db, kategori, nilai, id) {
  return db.prepare(
    "SELECT id, nilai FROM master_kegiatan WHERE lower(trim(kategori)) = lower(trim(?1)) " +
    "AND lower(trim(nilai)) = lower(trim(?2)) AND id <> ?3"
  ).bind(kategori, nilai, Number(id) || 0).first();
}

async function findMasterBlok(db, id) {
  return db.prepare(
    "SELECT id, kategori, nilai FROM master_kegiatan WHERE id = ?1 AND lower(trim(kategori)) = 'blok'"
  ).bind(Number(id) || 0).first();
}

async function blokRenamePlan(db, payload, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = Number(payload && payload.id) || 0;
  const newValue = masterValue(payload && payload.newValue);
  if (!id) return { success: false, code: 'INVALID_ID', message: 'Baris master tidak valid.' };
  if (!newValue) return { success: false, code: 'INVALID_VALUE', message: 'Nama baru wajib diisi.' };
  const row = await findMasterBlok(db, id);
  if (!row) return { success: false, code: 'NOT_FOUND', message: 'Blok tidak ditemukan.' };
  const oldValue = masterValue(row.nilai);
  const sameValue = oldValue.toLowerCase() === newValue.toLowerCase();
  const impact = await blokUsage(db, oldValue);
  const targetUsage = sameValue ? { total: 0 } : await blokUsage(db, newValue);
  const masterConflict = await findMasterConflict(db, 'Blok', newValue, id);
  const dataConflict = targetUsage.total > 0;
  const regenRow = await db.prepare(
    "SELECT COUNT(*) AS n FROM berita_acara_admin WHERE lower(trim(blok)) = lower(trim(?1)) " +
    "AND coalesce(file_url, '') <> ''"
  ).bind(oldValue).first();
  return {
    success: true,
    id: id,
    oldValue: oldValue,
    newValue: newValue,
    impact: impact,
    total: impact.total,
    baRegen: Number(regenRow && regenRow.n) || 0,
    conflicts: { master: !!masterConflict, data: dataConflict }
  };
}

export async function previewMasterRename(db, payload, ctx) {
  return blokRenamePlan(db, payload, ctx);
}

export async function renameMasterValue(db, payload, ctx) {
  const plan = await blokRenamePlan(db, payload, ctx);
  if (!plan.success) return plan;
  if (plan.oldValue.toLowerCase() === plan.newValue.toLowerCase() && plan.oldValue === plan.newValue) {
    return { success: true, message: 'Nama blok tidak berubah.', oldValue: plan.oldValue, newValue: plan.newValue, impact: plan.impact, total: plan.total };
  }
  if (plan.conflicts.master) {
    return {
      success: false, code: 'RENAME_CONFLICT',
      message: 'Blok "' + plan.newValue + '" sudah ada di master. Gunakan nama lain atau selesaikan lewat merge.',
      oldValue: plan.oldValue, newValue: plan.newValue, impact: plan.impact, total: plan.total
    };
  }
  if (plan.conflicts.data) {
    return {
      success: false, code: 'RENAME_CONFLICT',
      message: 'Blok "' + plan.newValue + '" sudah dipakai data lain. Rename akan menggabungkan dua blok; selesaikan manual terlebih dahulu.',
      oldValue: plan.oldValue, newValue: plan.newValue, impact: plan.impact, total: plan.total
    };
  }
  if (plan.total > MAX_RENAME_ROWS) {
    return { success: false, code: 'TOO_MANY_ROWS', message: 'Terlalu banyak baris terdampak (maks ' + MAX_RENAME_ROWS + ').' };
  }

  const statements = [];
  statements.push(db.prepare('UPDATE master_kegiatan SET nilai = ?1 WHERE id = ?2').bind(plan.newValue, plan.id));
  statements.push(db.prepare(
    "UPDATE berita_acara_admin SET needs_regen = 1 WHERE lower(trim(blok)) = lower(trim(?1)) " +
    "AND coalesce(file_url, '') <> ''"
  ).bind(plan.oldValue));
  for (const table of BLOK_REF_TABLES) {
    statements.push(db.prepare(
      'UPDATE ' + table + ' SET blok = ?1 WHERE lower(trim(blok)) = lower(trim(?2))'
    ).bind(plan.newValue, plan.oldValue));
  }
  for (const table of KEGIATAN_KEY_TABLES) {
    const { results } = await db.prepare(
      'SELECT id, bagian, nama_kegiatan FROM ' + table + ' WHERE lower(trim(blok)) = lower(trim(?1))'
    ).bind(plan.oldValue).all();
    for (const r of results || []) {
      statements.push(db.prepare('UPDATE ' + table + ' SET kegiatan_key = ?1 WHERE id = ?2')
        .bind(kegiatanKey(r.bagian, plan.newValue, r.nama_kegiatan), r.id));
    }
  }
  await db.batch(statements);
  await writeAuditLog(db, {
    actor: (ctx.session && ctx.session.nama) || 'Admin',
    action: 'RENAME_MASTER',
    target: 'Blok: ' + plan.oldValue + ' -> ' + plan.newValue,
    detail: JSON.stringify(plan.impact)
  });
  return {
    success: true,
    message: 'Blok diubah menjadi "' + plan.newValue + '". ' + plan.total + ' baris diperbarui' +
      (plan.baRegen ? ', ' + plan.baRegen + ' BA perlu dibuat ulang.' : '.'),
    oldValue: plan.oldValue,
    newValue: plan.newValue,
    impact: plan.impact,
    total: plan.total,
    baRegen: plan.baRegen
  };
}

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
  await requireAdmin(db, ctx.token, ctx.session);
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
  if (table === 'master_kegiatan') {
    mapped.kategori = masterValue(mapped.kategori);
    mapped.nilai = masterValue(mapped.nilai);
    if (!mapped.kategori || !mapped.nilai) return { success: false, message: 'Kategori dan nilai wajib diisi.' };
    const conflict = await findMasterConflict(db, mapped.kategori, mapped.nilai, id);
    if (conflict) {
      return { success: false, code: 'DUPLICATE_MASTER', message: 'Nilai ' + mapped.nilai + ' sudah ada pada kategori ' + mapped.kategori + '.' };
    }
    if (id) {
      const existing = await db.prepare('SELECT id, kategori, nilai FROM master_kegiatan WHERE id = ?1').bind(id).first();
      if (existing && String(existing.kategori || '').trim().toLowerCase() === 'blok') {
        const oldValue = masterValue(existing.nilai);
        const changed = String(existing.kategori || '').trim().toLowerCase() !== mapped.kategori.toLowerCase() ||
          oldValue.toLowerCase() !== mapped.nilai.toLowerCase();
        if (changed) {
          const usage = await blokUsage(db, oldValue);
          if (usage.total > 0) {
            return {
              success: false, code: 'RENAME_REQUIRED',
              message: 'Blok "' + oldValue + '" sudah dipakai di ' + usage.total + ' baris. Gunakan tombol Ganti nama agar semua data ikut diperbarui.',
              impact: usage
            };
          }
        }
      }
    }
  }
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
  await requireAdmin(db, ctx.token, ctx.session);
  const table = str(payload && payload.table);
  if (table === 'config') return { success: false, message: 'Config tidak boleh dihapus.' };
  const spec = MASTER_TABLES[table];
  if (!spec) return { success: false, message: 'Tabel tidak dikenal.' };
  const id = Number(payload && payload.id) || 0;
  if (!id) return { success: false, message: 'ID tidak valid.' };
  const exists = await db.prepare('SELECT id, kategori, nilai FROM ' + table + ' WHERE id = ?1').bind(id).first();
  if (!exists) return { success: false, message: 'Baris tidak ditemukan.' };
  if (table === 'master_kegiatan' && String(exists.kategori || '').trim().toLowerCase() === 'blok') {
    const usage = await blokUsage(db, masterValue(exists.nilai));
    if (usage.total > 0) {
      return {
        success: false, code: 'MASTER_IN_USE',
        message: 'Blok "' + masterValue(exists.nilai) + '" masih dipakai di ' + usage.total + ' baris. Ganti nama atau pindahkan datanya terlebih dahulu.',
        impact: usage
      };
    }
  }
  await db.prepare('DELETE FROM ' + table + ' WHERE id = ?1').bind(id).run();
  return { success: true, message: 'Baris dihapus.' };
}
