import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

import { norm, parseCurrency } from '../src/read/common.js';

function str(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

function tableExists(db, name) {
  return !!db.prepare("SELECT 1 AS ada FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function biayaMapOf(db) {
  const map = {};
  for (const r of db.prepare('SELECT kegiatan, biaya FROM master_biaya').all()) {
    const k = str(r.kegiatan);
    if (k) map[k] = parseCurrency(r.biaya);
  }
  return map;
}

function overrideMapOf(db) {
  const map = {};
  for (const c of db.prepare('SELECT id_pengajuan, pilihan, detail, tanggal_pelaksanaan, biaya FROM check_data').all()) {
    const id = str(c.id_pengajuan);
    if (!id) continue;
    if (str(c.detail) !== 'BIAYA-OVERRIDE') continue;
    if (str(c.pilihan) || str(c.tanggal_pelaksanaan)) continue;
    if (!str(c.biaya)) continue;
    map[id] = parseCurrency(c.biaya);
  }
  return map;
}

function detailsByPengajuan(db) {
  const map = {};
  for (const d of db.prepare('SELECT id_pengajuan, jenis_kegiatan, pilihan, detail FROM detail_kegiatan ORDER BY id').all()) {
    const id = str(d.id_pengajuan);
    if (!id) continue;
    if (!map[id]) map[id] = [];
    map[id].push(d);
  }
  return map;
}

// Algoritma lama: override -> nama Jenis persis -> fuzzy substring.
function resolveOld(jenis, overrideValue, biayaMap) {
  if (overrideValue !== undefined) return overrideValue;
  const j = str(jenis);
  if (j && biayaMap[j] !== undefined) return biayaMap[j];
  const jn = norm(j);
  for (const k of Object.keys(biayaMap)) {
    const kn = norm(k);
    if (kn && jn && (jn.includes(kn) || kn.includes(jn))) return biayaMap[k];
  }
  return 0;
}

// Algoritma baru: override -> Detail efektif persis (Ujian/KKD/SGD kosong = Inhal).
function effectiveDetail(jenis, rows) {
  const j = str(jenis);
  if (j === 'Ujian') return 'Inhal';
  let detail = '';
  for (const d of rows || []) {
    const v = str(d.detail);
    if (v) { detail = v; break; }
  }
  if (!detail && (j === 'KKD' || j === 'SGD')) return 'Inhal';
  return detail;
}

function resolveNew(jenis, rows, overrideValue, biayaMap) {
  if (overrideValue !== undefined) return overrideValue;
  const target = norm(effectiveDetail(jenis, rows));
  if (!target) return 0;
  for (const k of Object.keys(biayaMap)) {
    if (norm(k) === target) return biayaMap[k];
  }
  return 0;
}

function rupiah(n) {
  return 'Rp ' + String(Math.trunc(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function analyzeBiayaDump(sql) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    for (const table of ['pengajuan', 'master_biaya', 'detail_kegiatan', 'check_data']) {
      if (!tableExists(db, table)) throw new Error('tabel ' + table + ' tidak ditemukan di dump');
    }

    const biayaMap = biayaMapOf(db);
    const overrideMap = overrideMapOf(db);
    const detailMap = detailsByPengajuan(db);
    const pengajuan = db.prepare(
      'SELECT id_pengajuan, jenis_kegiatan, npm, nama_lengkap, status FROM pengajuan ORDER BY id_pengajuan'
    ).all();

    let totalOld = 0;
    let totalNew = 0;
    const changed = [];
    const groups = {};

    for (const p of pengajuan) {
      const id = str(p.id_pengajuan);
      const rows = detailMap[id] || [];
      const overrideValue = overrideMap[id];
      const oldValue = resolveOld(p.jenis_kegiatan, overrideValue, biayaMap);
      const newValue = resolveNew(p.jenis_kegiatan, rows, overrideValue, biayaMap);
      totalOld += oldValue;
      totalNew += newValue;

      const detail = effectiveDetail(p.jenis_kegiatan, rows);
      const source = overrideValue !== undefined ? 'override' : ('detail:' + (detail || '-'));
      const groupKey = str(p.jenis_kegiatan) + '|' + (detail || '-');
      groups[groupKey] = groups[groupKey] || { count: 0, oldValue: oldValue, newValue: newValue, changed: 0 };
      groups[groupKey].count += 1;
      if (oldValue !== newValue) groups[groupKey].changed += 1;

      if (oldValue !== newValue) {
        changed.push({
          idPengajuan: id,
          npm: str(p.npm),
          nama: str(p.nama_lengkap),
          jenis: str(p.jenis_kegiatan),
          detail: detail,
          sumber: source,
          biayaLama: oldValue,
          biayaBaru: newValue,
          selisih: newValue - oldValue
        });
      }
    }

    const groupRows = Object.keys(groups).sort().map((key) => ({
      key: key,
      jumlah: groups[key].count,
      berubah: groups[key].changed,
      biayaLama: groups[key].oldValue,
      biayaBaru: groups[key].newValue
    }));

    return {
      dryRun: true,
      masterBiaya: Object.keys(biayaMap).map((k) => ({ kegiatan: k, biaya: biayaMap[k] })),
      summary: {
        totalPengajuan: pengajuan.length,
        totalOverride: Object.keys(overrideMap).length,
        totalLama: totalOld,
        totalBaru: totalNew,
        selisih: totalNew - totalOld,
        barisBerubah: changed.length,
        totalLamaRupiah: rupiah(totalOld),
        totalBaruRupiah: rupiah(totalNew),
        selisihRupiah: rupiah(totalNew - totalOld)
      },
      groups: groupRows,
      perubahan: changed
    };
  } finally {
    db.close();
  }
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Pemakaian: node scripts/audit-biaya-detail.mjs <dump.sql> [--json]');
    process.exit(2);
  }
  const json = process.argv.includes('--json');
  let result;
  try {
    result = analyzeBiayaDump(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error('Gagal menganalisis dump: ' + (error && error.message ? error.message : error));
    process.exit(1);
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const s = result.summary;
  console.log('Audit biaya berbasis Detail (dry-run, tidak menulis DB)');
  console.log('Pengajuan       : ' + s.totalPengajuan);
  console.log('Override manual : ' + s.totalOverride);
  console.log('Total lama      : ' + s.totalLamaRupiah);
  console.log('Total baru      : ' + s.totalBaruRupiah);
  console.log('Selisih         : ' + s.selisihRupiah);
  console.log('Baris berubah   : ' + s.barisBerubah);
  console.log('');
  console.log('Kelompok Jenis|Detail:');
  for (const g of result.groups) {
    console.log('  ' + String(g.jumlah).padStart(4) + '  ' + g.key.padEnd(22) +
      ' lama ' + rupiah(g.biayaLama).padEnd(14) + ' baru ' + rupiah(g.biayaBaru).padEnd(14) +
      ' berubah ' + g.berubah);
  }
  if (result.perubahan.length) {
    console.log('');
    console.log('Rincian baris berubah:');
    for (const c of result.perubahan) {
      console.log('  ' + c.idPengajuan + ' ' + c.npm + ' ' + c.jenis + '|' + c.detail +
        ' : ' + rupiah(c.biayaLama) + ' -> ' + rupiah(c.biayaBaru) + ' (' + c.sumber + ')');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
