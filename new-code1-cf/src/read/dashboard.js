import { requireAdmin } from '../session.js';
import { toClientRow, toClientRows } from './columns.js';
import { saveUpload } from '../uploads.js';
import {
  norm, parseCurrency, formatRupiah, getMasterOptions, getBiayaMap, getBiayaOverrideMap,
  resolveBiayaForPengajuan, normBagianAggregateWithLabs, resolveBagian12, getBagianOptions12,
  getBagianBaSettings, pushUnique
} from './common.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function baSumber(r) {
  const s = String((r && r.Sumber) || '').trim().toLowerCase();
  return s === 'admin' ? 'Admin' : 'Bagian';
}

function buildPengajuanClientRows(rows, biayaMap, overrideMap) {
  return rows.map((r) => {
    const copy = toClientRow('pengajuan', r);
    copy.Biaya = resolveBiayaForPengajuan(copy, biayaMap, overrideMap);
    copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
    const id = String(r.id_pengajuan || '').trim();
    copy.BiayaOverride = (overrideMap[id] !== undefined) ? String(overrideMap[id]) : '';
    return copy;
  });
}

export async function getDashboardStats(db, ctx) {
  await requireAdmin(db, ctx.token);
  return computeDashboardStats(db);
}

async function computeDashboardStats(db) {
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const ba = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  const labs = await getMasterOptions(db, 'Lab');
  const perStatus = {}, perJenis = {}, perBlok = {}, trend = {}, perBagian = {};
  let totalBiaya = 0;
  for (const p of pengajuan) {
    const row = toClientRow('pengajuan', p);
    const status = String(row.Status || 'Lainnya').trim();
    perStatus[status] = (perStatus[status] || 0) + 1;
    const jenis = String(row['Jenis Kegiatan'] || 'Lainnya').trim();
    perJenis[jenis] = (perJenis[jenis] || 0) + 1;
    const blok = String(row.Blok || '-').trim();
    perBlok[blok] = (perBlok[blok] || 0) + 1;
    totalBiaya += resolveBiayaForPengajuan(row, biayaMap, overrideMap);
    const ts = row.Timestamp;
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const key = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
        trend[key] = (trend[key] || 0) + 1;
      }
    }
  }
  for (const d of details) {
    const row = toClientRow('detail_kegiatan', d);
    const bagian = normBagianAggregateWithLabs(row['Jenis Kegiatan'] || row.Bagian, labs);
    perBagian[bagian] = (perBagian[bagian] || 0) + 1;
  }
  for (const b of ba) {
    const row = toClientRow('berita_acara', b);
    if (baSumber(row) !== 'Bagian') continue;
    const bagian = normBagianAggregateWithLabs(row.Bagian, labs);
    perBagian[bagian] = (perBagian[bagian] || 0) + (parseInt(row['Jumlah Peserta'], 10) || 0);
  }
  return { total: pengajuan.length, perStatus, perJenis, perBlok, trend, perBagian, totalBiaya, biayaMap };
}

export async function getDashboardBootstrap(db, ctx) {
  await requireAdmin(db, ctx.token);
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  const stats = await computeDashboardStats(db);

  const sorted = pengajuan.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const detailMap = {};
  for (const d of details) {
    const id = String(d.id_pengajuan || '').trim();
    if (!id) continue;
    if (!detailMap[id]) detailMap[id] = [];
    detailMap[id].push(toClientRow('detail_kegiatan', d));
  }
  const masterBiaya = Object.keys(biayaMap).map((k) => ({ Kegiatan: k, Biaya: biayaMap[k] }));
  masterBiaya.sort((a, b) => a.Biaya - b.Biaya);

  return {
    stats,
    pengajuan: buildPengajuanClientRows(sorted, biayaMap, overrideMap),
    detailMap,
    masterBiaya,
    dosen: await getMasterOptions(db, 'Dosen')
  };
}

export async function getPengajuanList(db, filters, ctx) {
  await requireAdmin(db, ctx.token);
  filters = filters || {};
  const fStatus = String(filters.status || '').trim();
  const fJenis = String(filters.jenis || '').trim();
  const fBlok = String(filters.blok || '').trim();
  const q = norm(filters.search || '');
  let rows = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const client = rows.map((r) => ({ raw: r, row: toClientRow('pengajuan', r) }));
  let selected = client;
  if (fStatus) selected = selected.filter((r) => String(r.row.Status || '').trim() === fStatus);
  if (fJenis) selected = selected.filter((r) => String(r.row['Jenis Kegiatan'] || '').trim() === fJenis);
  if (fBlok) selected = selected.filter((r) => String(r.row.Blok || '').trim() === fBlok);
  if (q) {
    selected = selected.filter((r) => {
      const npm = norm(r.row.NPM);
      const nama = norm(r.row['Nama Lengkap']);
      return (npm && npm.indexOf(q) !== -1) || (nama && nama.indexOf(q) !== -1);
    });
  }
  selected.sort((a, b) => String(b.row.Timestamp || '').localeCompare(String(a.row.Timestamp || '')));
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  return buildPengajuanClientRows(selected.map((r) => r.raw), biayaMap, overrideMap);
}

export async function getLabOptions(db, ctx) {
  await requireAdmin(db, ctx.token);
  return getMasterOptions(db, 'Lab');
}

export async function getPengajuanWithDetails(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token);
  const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(String(idPengajuan || '').trim()).first();
  if (!p) return null;
  const copy = toClientRow('pengajuan', p);
  const details = (await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(String(idPengajuan || '').trim()).all()).results || [];
  copy.details = toClientRows('detail_kegiatan', details);
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  copy.Biaya = resolveBiayaForPengajuan(copy, biayaMap, overrideMap);
  const id = String(p.id_pengajuan || '').trim();
  copy.BiayaOverride = (overrideMap[id] !== undefined) ? String(overrideMap[id]) : '';
  copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
  return copy;
}

export async function getBagianAggregation(db, ctx) {
  await requireAdmin(db, ctx.token);
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const ba = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const labs = await getMasterOptions(db, 'Lab');
  const pMap = {};
  for (const p of pengajuan) pMap[String(p.id_pengajuan || '').trim()] = toClientRow('pengajuan', p);

  const bagianRows = [];
  const bagianIndex = {};
  const addRow = (sumber, bagian, blok, jenisKegiatan, tgl, jumlah, fileUrl, linkFinal) => {
    blok = String(blok || '-').replace(/\s+/g, ' ').trim();
    jenisKegiatan = String(jenisKegiatan || '-').replace(/\s+/g, ' ').trim();
    tgl = String(tgl || '-').replace(/\s+/g, ' ').trim();
    const key = [sumber, bagian, blok, jenisKegiatan, tgl].join('|');
    if (bagianIndex[key] !== undefined) {
      bagianRows[bagianIndex[key]].total += jumlah;
      if (linkFinal && !bagianRows[bagianIndex[key]].linkFinal) bagianRows[bagianIndex[key]].linkFinal = linkFinal;
    } else {
      bagianIndex[key] = bagianRows.length;
      bagianRows.push({ sumber, bagian, blok, jenisKegiatan, tanggalPelaksanaan: tgl, total: jumlah, fileUrl: fileUrl || '', linkFinal: linkFinal || '' });
    }
  };
  for (const d of details) {
    const row = toClientRow('detail_kegiatan', d);
    const p = pMap[String(row['ID Pengajuan'] || '').trim()] || {};
    const bagian = resolveBagian12(row['Jenis Kegiatan'] || row.Bagian, row.Pilihan || row.Bagian, '', labs) || 'Lainnya';
    const pilihan = String(row.Pilihan || '').trim();
    const detailText = String(row.Detail || '').trim();
    const jenisKegiatan = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
    addRow('Pengajuan', bagian, p.Blok, jenisKegiatan, row['Tanggal Pelaksanaan'], 1, '', p['Link Final']);
  }
  for (const b of ba) {
    const row = toClientRow('berita_acara', b);
    if (baSumber(row) !== 'Bagian') continue;
    const bagian = resolveBagian12(row.Bagian, '', row['Nama Kegiatan'], labs);
    if (!bagian) continue;
    addRow('Berita Acara', bagian, row.Blok, String(row['Nama Kegiatan'] || '').trim() || 'Berita Acara', row['Tanggal Pelaksanaan'], parseInt(row['Jumlah Peserta'], 10) || 0, row['File URL']);
  }
  const blokList = [];
  bagianRows.forEach((r) => pushUnique(blokList, r.blok));
  return {
    categories: getBagianOptions12(labs),
    labs,
    rows: bagianRows,
    filters: { bagian: getBagianOptions12(labs), blok: blokList, sumber: ['Pengajuan', 'Berita Acara'] }
  };
}

export async function getBeritaAcaraAdminList(db, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = (await db.prepare('SELECT * FROM berita_acara_admin').all()).results || [];
  rows.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const peserta = (await db.prepare('SELECT * FROM berita_acara_admin_peserta').all()).results || [];
  const map = {};
  for (const r of peserta) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!map[id]) map[id] = [];
    map[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }
  return rows.map((r) => {
    const c = toClientRow('berita_acara_admin', r);
    c.peserta = map[String(r.ba_id || '').trim()] || [];
    return c;
  });
}

export async function getMasterDataMonitor(db, ctx) {
  await requireAdmin(db, ctx.token);
  const all = async (table) => (await db.prepare(`SELECT * FROM ${table}`).all()).results || [];
  return {
    masterKegiatan: toClientRows('master_kegiatan', await all('master_kegiatan')),
    masterBagian: toClientRows('master_bagian', await all('master_bagian')),
    masterBiaya: toClientRows('master_biaya', await all('master_biaya')),
    config: toClientRows('config', await all('config')),
    bagianStaff: toClientRows('bagian_staff', await all('bagian_staff')),
    admin: toClientRows('admin', await all('admin')),
    bagianSettings: await getBagianBaSettings(db)
  };
}

export async function getBaUploadOptions(db, ctx) {
  await requireAdmin(db, ctx.token);
  try {
    const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
    const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
    const pMap = {};
    for (const p of pengajuan) pMap[String(p.id_pengajuan || '').trim()] = toClientRow('pengajuan', p);
    const blokList = [];
    const blokSeen = {};
    for (const p of pengajuan) {
      const b = String(toClientRow('pengajuan', p).Blok || '').replace(/\s+/g, ' ').trim();
      if (b && !blokSeen[b.toLowerCase()]) { blokSeen[b.toLowerCase()] = true; blokList.push(b); }
    }
    blokList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const detailMap = {};
    for (const d of details) {
      const row = toClientRow('detail_kegiatan', d);
      const p = pMap[String(row['ID Pengajuan'] || '').trim()];
      const blok = String((p && p.Blok) || '').replace(/\s+/g, ' ').trim();
      const jenis = String(row['Jenis Kegiatan'] || '').replace(/\s+/g, ' ').trim();
      const pilihan = String(row.Pilihan || '').replace(/\s+/g, ' ').trim();
      const detailText = String(row.Detail || '').replace(/\s+/g, ' ').trim();
      if (!jenis && !pilihan && !detailText) continue;
      const key = [blok.toLowerCase(), jenis.toLowerCase(), pilihan.toLowerCase(), detailText.toLowerCase()].join('|');
      if (!detailMap[key]) {
        const nama = pilihan + (detailText ? ' - ' + detailText : '');
        detailMap[key] = { blok, jenis, pilihan, detail: detailText, tanggalPelaksanaan: row['Tanggal Pelaksanaan'], label: (jenis || 'Lainnya') + ' \u2014 ' + (nama || '-'), count: 0 };
      }
      detailMap[key].count++;
    }
    const detailList = Object.keys(detailMap).map((k) => detailMap[k]);
    detailList.sort((a, b) => (a.blok.toLowerCase() + a.label.toLowerCase()).localeCompare(b.blok.toLowerCase() + b.label.toLowerCase()));
    return { blok: blokList, details: detailList, labs: await getMasterOptions(db, 'Lab') };
  } catch (e) {
    return { blok: [], details: [], labs: [] };
  }
}

export async function diagnosticData(db, ctx) {
  await requireAdmin(db, ctx.token);
  const count = async (table) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n || 0;
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const npmDebug = pengajuan.map((p) => {
    const raw = p.npm;
    const s = String(raw || '');
    const codes = [];
    for (let i = 0; i < s.length; i++) codes.push(s.charCodeAt(i));
    const st = String(p.status || '');
    const stCodes = [];
    for (let j = 0; j < st.length; j++) stCodes.push(st.charCodeAt(j));
    return { type: typeof raw, value: JSON.stringify(s), charCodes: codes.join(' '), nama: String(p.nama_lengkap || ''), status: JSON.stringify(st), statusCodes: stCodes.join(' '), timestampType: typeof p.timestamp };
  });
  return {
    sheetId: '',
    sheets: [],
    counts: {
      Pengajuan: pengajuan.length,
      DetailKegiatan: await count('detail_kegiatan'),
      StatusHistory: await count('status_history'),
      CheckData: await count('check_data'),
      Mahasiswa: await count('mahasiswa'),
      LogData: await count('log_data')
    },
    npmDebug,
    portalResult: null,
    listResult: null,
    menungguResult: null
  };
}

export async function getBagianBaSettingsHandler(db, ctx) {
  await requireAdmin(db, ctx.token);
  return getBagianBaSettings(db);
}

export async function uploadSuratKeterangan(db, idPengajuan, file, ctx) {
  await requireAdmin(db, ctx.token);
  const id = String(idPengajuan || '').trim();
  if (!id) return { success: false, message: 'ID pengajuan tidak valid.' };
  const row = await db.prepare('SELECT id_pengajuan FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!row) return { success: false, message: 'Pengajuan tidak ditemukan.' };
  const nowIso = new Date().toISOString();
  const res = await saveUpload(db, file, {
    pengajuanId: id, kind: 'surat', createdBy: 'admin', createdAt: nowIso
  });
  if (!res.ok) return { success: false, message: res.message };
  await db.prepare('UPDATE pengajuan SET link_surat_keterangan = ?1, updated_at = ?2 WHERE id_pengajuan = ?3')
    .bind(res.url, nowIso, id).run();
  return { success: true, url: res.url, message: 'Surat keterangan berhasil diunggah.' };
}
