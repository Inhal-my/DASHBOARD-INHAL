import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

import { jadwalIdentity } from '../src/read/jadwal.js';

function str(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

function tableExists(db, name) {
  return !!db.prepare("SELECT 1 AS ada FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = jadwalIdentity(row);
    const items = groups.get(key) || [];
    items.push(row);
    groups.set(key, items);
  }
  return groups;
}

function orderRows(a, b) {
  if (a.hasBa !== b.hasBa) return a.hasBa ? -1 : 1;
  const aTime = a.timestamp || '\uffff';
  const bTime = b.timestamp || '\uffff';
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return a.id - b.id;
}

export function analyzeJadwalDuplicates(db) {
  for (const table of ['jadwal_pelaksanaan', 'jadwal_peserta', 'berita_acara']) {
    if (!tableExists(db, table)) {
      throw new Error('tabel ' + table + ' tidak ditemukan di dump');
    }
  }

  const scheduleRows = db.prepare(
    'SELECT id, timestamp, jadwal_id, bagian, blok, nama_kegiatan, tanggal, jam, dosen, active ' +
    'FROM jadwal_pelaksanaan ORDER BY id'
  ).all();
  const pesertaRows = db.prepare(
    'SELECT jadwal_id, id_pengajuan, npm FROM jadwal_peserta'
  ).all();
  const baRows = db.prepare(
    "SELECT jadwal_id, ba_id FROM berita_acara WHERE trim(coalesce(jadwal_id, '')) <> ''"
  ).all();

  const pesertaByJadwal = new Map();
  for (const row of pesertaRows) {
    const id = str(row.jadwal_id);
    if (!id) continue;
    const list = pesertaByJadwal.get(id) || [];
    list.push({ idPengajuan: str(row.id_pengajuan), npm: str(row.npm) });
    pesertaByJadwal.set(id, list);
  }

  const baByJadwal = new Map();
  for (const row of baRows) {
    const id = str(row.jadwal_id);
    if (!id) continue;
    const list = baByJadwal.get(id) || [];
    if (!list.includes(str(row.ba_id))) list.push(str(row.ba_id));
    baByJadwal.set(id, list);
  }

  const activeRows = [];
  let inactiveRows = 0;
  for (const row of scheduleRows) {
    if (Number(row.active) !== 1) {
      inactiveRows += 1;
      continue;
    }
    const jadwalId = str(row.jadwal_id);
    const peserta = pesertaByJadwal.get(jadwalId) || [];
    const baIds = baByJadwal.get(jadwalId) || [];
    activeRows.push({
      id: Number(row.id) || 0,
      timestamp: str(row.timestamp),
      jadwalId: jadwalId,
      bagian: str(row.bagian),
      blok: str(row.blok),
      namaKegiatan: str(row.nama_kegiatan),
      tanggal: str(row.tanggal),
      jam: str(row.jam),
      dosen: str(row.dosen),
      peserta: peserta,
      baIds: baIds,
      hasBa: baIds.length > 0
    });
  }

  const groups = [];
  for (const [key, items] of groupRows(activeRows)) {
    if (items.length < 2) continue;
    const ordered = items.slice().sort(orderRows);
    const keep = ordered[0];
    const remove = ordered.slice(1);
    const removeWithBa = remove.filter((row) => row.hasBa).length;
    const toOutput = (row, isKeep) => ({
      jadwalId: row.jadwalId,
      dbId: row.id,
      timestamp: row.timestamp,
      tanggal: row.tanggal,
      jam: row.jam,
      dosen: row.dosen,
      pesertaCount: row.peserta.length,
      pesertaNpm: row.peserta.map((p) => p.npm).filter(Boolean),
      baIds: row.baIds,
      safeToRemove: isKeep ? false : !row.hasBa
    });
    groups.push({
      key: key,
      label: [keep.bagian, keep.blok, keep.namaKegiatan, keep.tanggal + ' ' + keep.jam]
        .filter(Boolean).join(' / '),
      count: items.length,
      extraRows: items.length - 1,
      needsManualReview: removeWithBa > 0,
      keep: toOutput(keep, true),
      remove: remove.map((row) => toOutput(row, false))
    });
  }

  groups.sort((a, b) => (b.extraRows - a.extraRows) || a.key.localeCompare(b.key));

  const summary = {
    totalGroups: groups.length,
    duplicateRows: groups.reduce((sum, g) => sum + g.count, 0),
    extraRows: groups.reduce((sum, g) => sum + g.extraRows, 0),
    manualReviewGroups: groups.filter((g) => g.needsManualReview).length,
    baLinkedRemovals: groups.reduce(
      (sum, g) => sum + g.remove.filter((row) => !row.safeToRemove).length,
      0
    ),
    activeRows: activeRows.length,
    inactiveRows: inactiveRows
  };

  return {
    dryRun: true,
    summary: summary,
    groups: groups
  };
}

export function analyzeJadwalDump(sql) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    return analyzeJadwalDuplicates(db);
  } finally {
    db.close();
  }
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Pemakaian: node scripts/audit-jadwal-duplikat.mjs <dump.sql>');
    process.exit(2);
  }
  let result;
  try {
    result = analyzeJadwalDump(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error('Gagal menganalisis dump: ' + (error && error.message ? error.message : error));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
