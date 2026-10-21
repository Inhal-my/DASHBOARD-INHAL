import { requireAdmin } from '../session.js';
import { kegiatanKey, norm } from './common.js';
import { BLOK_REF_TABLES, KEGIATAN_KEY_TABLES } from '../masterRefs.js';
import { auditDataQuality } from './dataQuality.js';

function clean(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function auditMasterIntegrity(db, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);

  const { results: masterRows } = await db.prepare('SELECT kategori, nilai FROM master_kegiatan').all();
  const groups = new Map();
  for (const row of masterRows || []) {
    const key = norm(row.kategori) + '|' + norm(row.nilai);
    const item = groups.get(key) || { kategori: clean(row.kategori), nilai: norm(row.nilai), count: 0 };
    item.count += 1;
    groups.set(key, item);
  }
  const duplicates = Array.from(groups.values()).filter((g) => g.count > 1);

  const blokMaster = new Set();
  for (const row of masterRows || []) {
    if (norm(row.kategori) === 'blok') blokMaster.add(norm(row.nilai));
  }

  const orphans = [];
  const blanks = [];
  for (const table of BLOK_REF_TABLES) {
    const blank = await db.prepare(
      "SELECT COUNT(*) AS n FROM " + table + " WHERE trim(coalesce(blok, '')) = ''"
    ).first();
    blanks.push({ table: table, count: Number(blank && blank.n) || 0 });

    const { results } = await db.prepare(
      'SELECT blok, COUNT(*) AS n FROM ' + table + " WHERE trim(coalesce(blok, '')) <> '' " +
      'GROUP BY lower(trim(blok))'
    ).all();
    for (const row of results || []) {
      if (!blokMaster.has(norm(row.blok))) {
        orphans.push({ table: table, blok: clean(row.blok), count: Number(row.n) || 0 });
      }
    }
  }

  const keyDrift = {};
  let keyDriftTotal = 0;
  for (const table of KEGIATAN_KEY_TABLES) {
    const { results } = await db.prepare(
      'SELECT id, bagian, blok, nama_kegiatan, kegiatan_key FROM ' + table
    ).all();
    const samples = [];
    let count = 0;
    for (const row of results || []) {
      const expected = kegiatanKey(row.bagian, row.blok, row.nama_kegiatan);
      if (String(row.kegiatan_key || '') !== expected) {
        count += 1;
        if (samples.length < 5) {
          samples.push({ id: row.id, expected: expected, actual: String(row.kegiatan_key || '') });
        }
      }
    }
    keyDrift[table] = { count: count, samples: samples };
    keyDriftTotal += count;
  }

  return {
    duplicates: duplicates,
    orphans: orphans,
    blanks: blanks,
    keyDrift: keyDrift,
    dataQuality: await auditDataQuality(db),
    totals: {
      duplicates: duplicates.length,
      orphans: orphans.reduce((sum, o) => sum + o.count, 0),
      blanks: blanks.reduce((sum, b) => sum + b.count, 0),
      keyDrift: keyDriftTotal
    }
  };
}
