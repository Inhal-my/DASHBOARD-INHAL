import { requireAdmin } from '../session.js';
import { toClientRow } from './columns.js';
import { formatRupiah, getMasterOptions, getBiayaMap, getBiayaOverrideMap, resolveBiayaForPengajuan, resolveBagian12, kegiatanKey } from './common.js';
import { computeUnitProgress } from './kegiatan.js';

function baSumber(r) {
  const s = String((r && r.Sumber) || '').trim().toLowerCase();
  return s === 'admin' ? 'Admin' : 'Bagian';
}

export async function getLaporanBootstrap(db, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const histories = (await db.prepare('SELECT * FROM status_history').all()).results || [];
  const ba = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  const baPeserta = (await db.prepare('SELECT * FROM berita_acara_peserta').all()).results || [];
  const pesertaMap = {};
  for (const r of baPeserta) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!pesertaMap[id]) pesertaMap[id] = [];
    pesertaMap[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }

  const jadwalRows = (await db.prepare('SELECT * FROM jadwal_pelaksanaan').all()).results || [];
  const jadwalPesertaRows = (await db.prepare('SELECT * FROM jadwal_peserta').all()).results || [];
  const jadwalPesertaByJadwal = {};
  for (const p of jadwalPesertaRows) {
    const j = String(p.jadwal_id || '').trim();
    if (!j) continue;
    if (!jadwalPesertaByJadwal[j]) jadwalPesertaByJadwal[j] = [];
    jadwalPesertaByJadwal[j].push({
      npm: String(p.npm || '').trim(),
      namaLengkap: String(p.nama_lengkap || '').trim(),
      blok: String(p.blok || '').trim(),
      statusPengajuan: String(p.status_pengajuan || '').trim()
    });
  }
  const baIdByJadwal = {};
  for (const b of ba) {
    const j = String(b.jadwal_id || '').trim();
    if (j && !baIdByJadwal[j]) baIdByJadwal[j] = String(b.ba_id || '').trim();
  }
  const jadwalList = [];
  for (const r of jadwalRows) {
    if (Number(r.active) !== 1) continue;
    const jid = String(r.jadwal_id || '').trim();
    const jBagian = String(r.bagian || '').trim();
    const jBlok = String(r.blok || '').trim();
    const jNama = String(r.nama_kegiatan || '').trim();
    const jKey = String(r.kegiatan_key || '').trim() || kegiatanKey(jBagian, jBlok, jNama);
    jadwalList.push({
      jadwalId: jid, kegiatanKey: jKey, bagian: jBagian, blok: jBlok,
      namaKegiatan: jNama, label: jNama,
      tanggal: String(r.tanggal || '').trim(), jam: String(r.jam || '').trim(),
      dosen: String(r.dosen || '').trim(), catatan: String(r.catatan || '').trim(),
      peserta: jadwalPesertaByJadwal[jid] || [], baId: baIdByJadwal[jid] || ''
    });
  }

  const baMemberByKey = {};
  const baKeyByBaId = {};
  for (const b of ba) {
    const c = toClientRow('berita_acara', b);
    if (baSumber(c) !== 'Bagian') continue;
    const id = String(b.ba_id || '').trim();
    if (!id) continue;
    baKeyByBaId[id] = String(b.kegiatan_key || '').trim() || kegiatanKey(c.Bagian, c.Blok, c['Nama Kegiatan']);
  }
  for (const r of baPeserta) {
    const key = baKeyByBaId[String(r.ba_id || '').trim()];
    const idp = String(r.id_pengajuan || '').trim();
    if (!key || !idp) continue;
    if (!baMemberByKey[key]) baMemberByKey[key] = new Set();
    baMemberByKey[key].add(idp);
  }

  const detailById = {};
  for (const d of details) {
    const k = String(d.id_pengajuan || '').trim();
    if (!detailById[k]) detailById[k] = [];
    detailById[k].push(toClientRow('detail_kegiatan', d));
  }
  const historyById = {};
  for (const h of histories) {
    const k = String(h.id_pengajuan || '').trim();
    if (!historyById[k]) historyById[k] = [];
    historyById[k].push(toClientRow('status_history', h));
  }

  let totalPendaftar = 0, totalDitolak = 0, totalMenunggu = 0, totalAcc = 0, totalBiaya = 0;
  const perJenis = {}, perBlok = {}, perStatus = {};
  const rows = pengajuan.map((p) => {
    const id = String(p.id_pengajuan || '').trim();
    const row = toClientRow('pengajuan', p);
    const status = String(row.Status || '').trim();
    totalPendaftar++;
    if (status === 'Ditolak') totalDitolak++;
    if (status === 'Menunggu') totalMenunggu++;
    if (status === 'ACC') totalAcc++;
    perStatus[status || 'Lainnya'] = (perStatus[status || 'Lainnya'] || 0) + 1;
    const jenis = String(row['Jenis Kegiatan'] || 'Lainnya').trim();
    perJenis[jenis] = (perJenis[jenis] || 0) + 1;
    const blok = String(row.Blok || '-').trim();
    perBlok[blok] = (perBlok[blok] || 0) + 1;
    row.Biaya = resolveBiayaForPengajuan(row, biayaMap, overrideMap);
    row['Biaya Rupiah'] = formatRupiah(row.Biaya);
    totalBiaya += row.Biaya;
    return { pengajuan: row, details: detailById[id] || [], history: historyById[id] || [] };
  });

  const sortedBa = ba.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const beritaAcara = sortedBa.filter((r) => baSumber(toClientRow('berita_acara', r)) === 'Bagian').map((r) => {
    const c = toClientRow('berita_acara', r);
    c.peserta = pesertaMap[String(r.ba_id || '').trim()] || [];
    return c;
  });

  const pushUnique = (list, v) => {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    if (s && list.indexOf(s) === -1) list.push(s);
  };
  const dosen = [];
  pengajuan.forEach((p) => pushUnique(dosen, toClientRow('pengajuan', p).Dosen));
  dosen.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const blok = [];
  pengajuan.forEach((p) => pushUnique(blok, toClientRow('pengajuan', p).Blok));
  ba.forEach((b) => pushUnique(blok, toClientRow('berita_acara', b).Blok));
  blok.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const labs = await getMasterOptions(db, 'Lab');
  const baAdmin = (await db.prepare('SELECT * FROM berita_acara_admin').all()).results || [];
  const baAdminClient = baAdmin.map((r) => toClientRow('berita_acara_admin', r));
  const baClientUnits = sortedBa
    .filter((r) => baSumber(toClientRow('berita_acara', r)) === 'Bagian')
    .map((r) => {
      const c = toClientRow('berita_acara', r);
      c.peserta = pesertaMap[String(r.ba_id || '').trim()] || [];
      return c;
    });

  const units = [];
  const unitIndex = {};
  for (const row of rows) {
    const p = row.pengajuan;
    const idp = String(p['ID Pengajuan'] || '').trim();
    for (const d of row.details) {
      const bagian = resolveBagian12(String(d['Jenis Kegiatan'] || d.Bagian || '').trim(), String(d.Pilihan || d.Bagian || '').trim(), '', labs) || String(d.Bagian || '').trim() || 'Lainnya';
      const blokUnit = String(p.Blok || '').trim();
      const pilihan = String(d.Pilihan || '').trim();
      const detailText = String(d.Detail || '').trim();
      const label = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
      const key = kegiatanKey(bagian, blokUnit, label);
      if (unitIndex[key] === undefined) {
        unitIndex[key] = units.length;
        units.push({ key, bagian, blok: blokUnit, label, peserta: [], baPendukung: [], baPelaksanaan: [], pelaksanaan: [], dosenList: [], jadwal: [] });
      }
      const u = units[unitIndex[key]];
      if (!u.peserta.some((x) => x.idPengajuan === idp)) {
        const memberSet = baMemberByKey[key];
        u.peserta.push({
          idPengajuan: idp,
          npm: String(p.NPM || '').trim(),
          namaLengkap: String(p['Nama Lengkap'] || '').trim(),
          statusPengajuan: String(p.Status || '').trim(),
          linkFinal: String(p['Link Final'] || '').trim(),
          masukBa: !!(memberSet && memberSet.has(idp))
        });
      }
    }
  }
  const attach = (list, bucket) => {
    for (const b of list) {
      const key = b['Kegiatan Key'] || kegiatanKey(b.Bagian, b.Blok, b['Nama Kegiatan']);
      const u = unitIndex[key] !== undefined ? units[unitIndex[key]] : null;
      if (!u) continue;
      u[bucket].push(b);
    }
  };
  attach(baAdminClient, 'baPendukung');
  attach(baClientUnits, 'baPelaksanaan');
  for (const u of units) {
    u.pelaksanaan = u.baPelaksanaan.map((b) => ({ baId: b['BA ID'], tanggal: b['Tanggal Pelaksanaan'], jam: b.Jam || '', dosen: b.Dosen || '' }));
    const dosenSet = [];
    for (const b of u.baPelaksanaan) if (b.Dosen && dosenSet.indexOf(b.Dosen) === -1) dosenSet.push(b.Dosen);
    u.dosenList = dosenSet;
    u.progress = computeUnitProgress(u);
    u.counts = u.progress.counts;
  }

  const jadwalByKey = {};
  for (const j of jadwalList) {
    if (!jadwalByKey[j.kegiatanKey]) jadwalByKey[j.kegiatanKey] = [];
    jadwalByKey[j.kegiatanKey].push({
      jadwalId: j.jadwalId, tanggal: j.tanggal, jam: j.jam, dosen: j.dosen,
      catatan: j.catatan, peserta: j.peserta, baId: j.baId
    });
  }
  for (const u of units) u.jadwal = jadwalByKey[u.key] || [];

  return {
    summary: { totalPendaftar, totalDitolak, totalMenunggu, totalAcc, totalBiaya, perJenis, perBlok, perStatus },
    rows,
    beritaAcara,
    dosen,
    dosenOptions: await getMasterOptions(db, 'Dosen'),
    blok,
    kegiatan: units,
    jadwal: jadwalList,
    bagian: { categories: ['Ujian', 'SGD', 'KKD'], labs }
  };
}
