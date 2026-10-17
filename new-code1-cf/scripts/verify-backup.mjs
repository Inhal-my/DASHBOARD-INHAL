import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { BLOK_REF_TABLES, KEGIATAN_KEY_TABLES } from '../src/masterRefs.js';

const file = process.argv[2];
if (!file) {
  console.error('Pemakaian: node scripts/verify-backup.mjs <file.sql>');
  process.exit(2);
}

function safe(identifier) {
  return '"' + String(identifier).replace(/"/g, '""') + '"';
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normKegiatan(value) {
  return norm(String(value || '').replace(/[\u2010-\u2015\u2212]/g, '-'));
}

function kegiatanKey(bagian, blok, nama) {
  return [norm(bagian), norm(blok), normKegiatan(nama)].join('|');
}

let db;
try {
  const sql = readFileSync(file, 'utf8');
  db = new DatabaseSync(':memory:');
  db.exec(sql);
} catch (err) {
  console.error('Gagal mengimpor dump: ' + (err && err.message ? err.message : err));
  process.exit(1);
}

const coreTables = ['mahasiswa', 'pengajuan', 'master_kegiatan', 'berita_acara', 'berita_acara_admin'];
const existing = new Set(
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name)
);
const missing = coreTables.filter((t) => !existing.has(t));

const integrityRows = db.prepare('PRAGMA integrity_check').all();
const integrity = integrityRows.length ? String(integrityRows[0].integrity_check || '') : 'gagal';

const counts = {};
for (const table of coreTables) {
  if (!existing.has(table)) continue;
  counts[table] = Number(db.prepare('SELECT COUNT(*) AS n FROM ' + safe(table)).get().n) || 0;
}

const duplicates = db.prepare(
  'SELECT kategori, nilai, COUNT(*) AS n FROM master_kegiatan ' +
  'GROUP BY lower(trim(kategori)), lower(trim(nilai)) HAVING COUNT(*) > 1'
).all().map((r) => ({ kategori: r.kategori, nilai: r.nilai, count: Number(r.n) }));

const masterBlok = new Set(
  db.prepare("SELECT nilai FROM master_kegiatan WHERE lower(trim(kategori)) = 'blok'")
    .all().map((r) => norm(r.nilai))
);

const orphans = [];
const blanks = [];
if (existing.has('master_kegiatan')) {
  for (const table of BLOK_REF_TABLES) {
    if (!existing.has(table)) continue;
    const blank = Number(db.prepare(
      "SELECT COUNT(*) AS n FROM " + safe(table) + " WHERE trim(coalesce(blok, '')) = ''"
    ).get().n) || 0;
    if (blank) blanks.push({ table: table, count: blank });
    const rows = db.prepare(
      'SELECT blok, COUNT(*) AS n FROM ' + safe(table) +
      " WHERE trim(coalesce(blok, '')) <> '' GROUP BY lower(trim(blok))"
    ).all();
    for (const row of rows) {
      if (!masterBlok.has(norm(row.blok))) {
        orphans.push({ table: table, blok: row.blok, count: Number(row.n) });
      }
    }
  }
}

let driftTotal = 0;
const drift = [];
for (const table of KEGIATAN_KEY_TABLES) {
  if (!existing.has(table)) continue;
  let count = 0;
  const rows = db.prepare(
    'SELECT id, bagian, blok, nama_kegiatan, kegiatan_key FROM ' + safe(table)
  ).all();
  for (const row of rows) {
    if (String(row.kegiatan_key || '') !== kegiatanKey(row.bagian, row.blok, row.nama_kegiatan)) {
      count += 1;
      if (drift.length < 10) {
        drift.push({
          table: table,
          id: row.id,
          expected: kegiatanKey(row.bagian, row.blok, row.nama_kegiatan),
          actual: String(row.kegiatan_key || '')
        });
      }
    }
  }
  if (count) drift.push({ table: table, count: count });
  driftTotal += count;
}

const failures = [];
if (integrity !== 'ok') failures.push('integrity_check: ' + integrity);
if (missing.length) failures.push('tabel inti hilang: ' + missing.join(', '));
if (!counts.master_kegiatan) failures.push('master_kegiatan kosong');
if (!counts.mahasiswa) failures.push('mahasiswa kosong');
if (duplicates.length) failures.push('duplikat master: ' + duplicates.length);
if (orphans.length) failures.push('referensi blok asing: ' + orphans.length);
if (driftTotal) failures.push('kegiatan_key drift: ' + driftTotal);

const result = {
  file: file,
  integrity: integrity,
  counts: counts,
  duplicates: duplicates,
  orphans: orphans,
  blanks: blanks,
  keyDrift: { total: driftTotal, samples: drift },
  ok: failures.length === 0,
  failures: failures
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
