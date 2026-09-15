import { requireAdmin } from '../session.js';
import { toClientRow, toClientRows } from './columns.js';
import { saveDriveFile } from '../drive.js';
import {
  norm, parseCurrency, formatRupiah, getMasterOptions, getBiayaMap, getBiayaOverrideMap,
  resolveBiayaForPengajuan, normBagianAggregateWithLabs, resolveBagian12, getBagianOptions12,
  getBagianBaSettings, pushUnique, kegiatanKey, normKegiatan
} from './common.js';
import { computeUnitProgress } from './kegiatan.js';

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
  const all = async (table) => (await db.prepare(`SELECT * FROM ${table}`).all()).results || [];
  const pengajuan = await all('pengajuan');
  const details = await all('detail_kegiatan');
  const labs = await getMasterOptions(db, 'Lab');

  const pMap = {};
  for (const p of pengajuan) pMap[String(p.id_pengajuan || '').trim()] = toClientRow('pengajuan', p);

  const units = [];
  const unitIndex = {};
  const addPeserta = (unit, row) => {
    const dup = unit.peserta.some((x) =>
      (row.npm && x.npm === row.npm) || (!row.npm && row.idPengajuan && x.idPengajuan === row.idPengajuan));
    if (!dup) unit.peserta.push(row);
  };

  for (const d of details) {
    const row = toClientRow('detail_kegiatan', d);
    const idp = String(row['ID Pengajuan'] || '').trim();
    const p = pMap[idp] || {};
    const bagian = resolveBagian12(row['Jenis Kegiatan'] || row.Bagian, row.Pilihan || row.Bagian, '', labs) || 'Lainnya';
    const blok = String(p.Blok || row.Bagian || '').replace(/\s+/g, ' ').trim() || '-';
    const pilihan = String(row.Pilihan || '').trim();
    const detailText = String(row.Detail || '').trim();
    const label = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
    const key = kegiatanKey(bagian, blok, label);
    if (unitIndex[key] === undefined) {
      unitIndex[key] = units.length;
      units.push({ key, bagian, blok, pilihan, detail: detailText, label, tanggal: '', tanggalList: [], peserta: [], ba: [], linkFinal: '' });
    }
    const unit = units[unitIndex[key]];
    addPeserta(unit, {
      npm: String(p.NPM || '').trim(),
      namaLengkap: String(p['Nama Lengkap'] || '').trim(),
      blok: String(p.Blok || '').trim(),
      statusPengajuan: String(p.Status || '').trim(),
      linkFinal: String(p['Link Final'] || '').trim(),
      idPengajuan: idp
    });
    const tgl = String(row['Tanggal Pelaksanaan'] || '').trim();
    if (tgl && unit.tanggalList.indexOf(tgl) === -1) unit.tanggalList.push(tgl);
    const lf = String(p['Link Final'] || '').trim();
    if (lf && !unit.linkFinal) unit.linkFinal = lf;
  }

  const normKegiatanText = normKegiatan;

  async function collectBa(table, pesertaTable, sumber) {
    const rows = await all(table);
    const ps = await all(pesertaTable);
    const byId = {};
    const out = [];
    for (const r of rows) {
      const c = toClientRow(table, r);
      const baId = String(c['BA ID'] || '').trim();
      const rec = {
        baId, sumber,
        bagian: String(c.Bagian || '').trim(),
        blok: String(c.Blok || '').replace(/\s+/g, ' ').trim(),
        namaKegiatan: String(c['Nama Kegiatan'] || '').replace(/\s+/g, ' ').trim(),
        tanggal: String(c['Tanggal Pelaksanaan'] || '').trim(),
        jam: String(c.Jam || '').trim(),
        dosen: String(c.Dosen || '').trim(),
        kegiatanKey: String(c['Kegiatan Key'] || '').trim(),
        fileUrl: String(c['File URL'] || '').trim(),
        fileName: String(c['File Name'] || '').trim(),
        catatan: String(c.Catatan || '').trim(),
        timestamp: String(c.Timestamp || '').trim(),
        peserta: []
      };
      byId[baId] = rec;
      out.push(rec);
    }
    for (const p of ps) {
      const baId = String(p.ba_id || '').trim();
      if (byId[baId]) byId[baId].peserta.push({
        npm: String(p.npm || '').trim(),
        namaLengkap: String(p.nama_lengkap || '').trim(),
        blok: String(p.blok || '').trim()
      });
    }
    return out;
  }

  const seenBa = new Set();
  const baList = [];
  for (const b of [].concat(
    await collectBa('berita_acara', 'berita_acara_peserta', 'Bagian'),
    await collectBa('berita_acara_admin', 'berita_acara_admin_peserta', 'Admin')
  )) {
    const dk = [norm(b.bagian), b.blok.toLowerCase(), normKegiatanText(b.namaKegiatan), b.tanggal, b.fileUrl].join('|');
    if (seenBa.has(dk)) continue;
    seenBa.add(dk);
    baList.push(b);
  }

  const bagKey = (bagian, blok) => norm(bagian) + '|' + String(blok || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const unitByBag = {};
  for (const u of units) {
    const k = bagKey(u.bagian, u.blok);
    (unitByBag[k] = unitByBag[k] || []).push(u);
  }

  const unitByKey = {};
  for (const u of units) unitByKey[u.key] = u;

  const orphanBa = [];
  for (const b of baList) {
    const direct = b.kegiatanKey ? unitByKey[b.kegiatanKey] : null;
    if (direct) { direct.ba.push(b); continue; }
    const bBagian = resolveBagian12(b.bagian, '', b.namaKegiatan, labs) || b.bagian;
    const candidates = unitByBag[bagKey(bBagian, b.blok)] || [];
    const bNpms = b.peserta.map((p) => p.npm).filter(Boolean);
    let matched = candidates.filter((u) => u.peserta.some((p) => p.npm && bNpms.indexOf(p.npm) !== -1));
    if (!matched.length) {
      const bName = normKegiatanText(b.namaKegiatan);
      matched = candidates.filter((u) => {
        const l = normKegiatanText(u.label);
        return !!l && (bName === l || bName.endsWith(l));
      });
    }
    if (!matched.length) { orphanBa.push(b); continue; }
    for (const u of matched) u.ba.push(b);
  }

  const npmSet = new Set();
  for (const u of units) {
    const covered = new Set();
    for (const b of u.ba) for (const p of b.peserta) if (p.npm) covered.add(p.npm);
    u.pesertaDenganBa = u.peserta.filter((p) => p.npm && covered.has(p.npm)).length;
    u.jumlahPeserta = u.peserta.length;
    u.statusBa = u.ba.length ? 'ada' : 'belum';
    u.statusFinal = u.linkFinal ? 'ada' : 'belum';
    u.baPendukung = u.ba.filter((b) => b.sumber === 'Admin');
    u.baPelaksanaan = u.ba.filter((b) => b.sumber === 'Bagian');
    u.pelaksanaan = u.baPelaksanaan.map((b) => ({ baId: b.baId, tanggal: b.tanggal, jam: b.jam || '', dosen: b.dosen || '' }));
    const dosenSet = [];
    for (const b of u.baPelaksanaan) if (b.dosen && dosenSet.indexOf(b.dosen) === -1) dosenSet.push(b.dosen);
    u.dosenList = dosenSet;
    u.progress = computeUnitProgress(u);
    u.counts = u.progress.counts;
    u.tanggalList = u.tanggalList.slice().sort();
    u.tanggal = u.tanggalList[0] || '';
    for (const p of u.peserta) if (p.npm) npmSet.add(p.npm);
  }

  const blokSet = [];
  for (const u of units) pushUnique(blokSet, u.blok);

  const summary = {
    totalKegiatan: units.length,
    totalPeserta: npmSet.size,
    denganBa: units.filter((u) => u.ba.length).length,
    denganBaBagian: units.filter((u) => u.ba.some((b) => b.sumber === 'Bagian')).length,
    denganBaAdmin: units.filter((u) => u.ba.some((b) => b.sumber === 'Admin')).length,
    belumBa: units.filter((u) => !u.ba.length).length,
    finalAcc: units.filter((u) => u.linkFinal).length
  };
  summary.persenLengkap = summary.totalKegiatan ? Math.round((summary.denganBa / summary.totalKegiatan) * 100) : 0;

  return {
    categories: getBagianOptions12(labs),
    labs,
    filters: { bagian: getBagianOptions12(labs), blok: blokSet.sort(), sumber: ['Bagian', 'Admin'] },
    summary,
    units,
    orphanBa
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
  const maskSecret = (rows, field) => (rows || []).map((r) => Object.assign({}, r, { [field]: '' }));
  return {
    mahasiswa: toClientRows('mahasiswa', await all('mahasiswa')),
    masterKegiatan: toClientRows('master_kegiatan', await all('master_kegiatan')),
    masterBagian: toClientRows('master_bagian', await all('master_bagian')),
    masterBiaya: toClientRows('master_biaya', await all('master_biaya')),
    config: toClientRows('config', await all('config')),
    bagianStaff: maskSecret(toClientRows('bagian_staff', await all('bagian_staff')), 'Pass'),
    admin: maskSecret(toClientRows('admin', await all('admin')), 'Password'),
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
      LogData: await count('log_data'),
      LogUpload: await count('log_upload'),
      AuditLog: await count('audit_log')
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
  const res = await saveDriveFile(ctx.env, file, 'surat-' + id, { label: 'surat keterangan' });
  if (!res.ok) return { success: false, message: res.message };
  await db.prepare('UPDATE pengajuan SET link_surat_keterangan = ?1, updated_at = ?2 WHERE id_pengajuan = ?3')
    .bind(res.url, nowIso, id).run();
  return { success: true, url: res.url, message: 'Surat keterangan berhasil diunggah.' };
}
